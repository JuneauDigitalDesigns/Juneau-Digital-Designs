/**
 * An in-memory Upstash REST server on `fetch`, faithful enough to race on.
 *
 * The lead gate's guarantees are Redis semantics: SET NX decides which of twenty identical
 * submissions places the one call, INCR/EXPIRE decide the caps, GETDEL makes a follow-up
 * one-shot. A fake that answered "OK" to everything would certify a burst placing twenty calls.
 * So this one implements those commands for real, with expiry on a clock the test can move.
 *
 * The network is the only double: the real `@upstash/redis` client builds the requests.
 */

const b64 = (s) => Buffer.from(String(s), "utf8").toString("base64");

export function fakeUpstash({ url = "https://kv.test.invalid", resolve = () => undefined } = {}) {
    const kv = new Map(); // key -> { value: string, exp: number | null }
    const sets = new Map(); // key -> Set<string>
    const zsets = new Map(); // key -> Map<member, score>
    const lists = new Map(); // key -> string[]
    let offset = 0;
    const now = () => Date.now() + offset;
    const commands = [];

    const live = (key) => {
        const e = kv.get(key);
        if (!e) return undefined;
        if (e.exp !== null && e.exp <= now()) {
            kv.delete(key);
            return undefined;
        }
        return e;
    };

    function run(command) {
        const [rawOp, ...args] = command;
        const op = rawOp.toLowerCase();
        commands.push([op, ...args]);
        switch (op) {
            case "get": {
                const hooked = resolve(args[0]);
                if (hooked !== undefined) return hooked === null ? null : b64(JSON.stringify(hooked));
                const e = live(args[0]);
                return e ? b64(e.value) : null;
            }
            case "getdel": {
                const e = live(args[0]);
                kv.delete(args[0]);
                return e ? b64(e.value) : null;
            }
            case "mget":
                return args.map((k) => {
                    const e = live(k);
                    return e ? b64(e.value) : null;
                });
            case "set": {
                const [key, value, ...opts] = args;
                let nx = false;
                let exp = null;
                for (let i = 0; i < opts.length; i++) {
                    const o = String(opts[i]).toLowerCase();
                    if (o === "nx") nx = true;
                    else if (o === "ex") exp = now() + Number(opts[++i]) * 1000;
                    else if (o === "px") exp = now() + Number(opts[++i]);
                }
                if (nx && live(key)) return null;
                kv.set(key, { value: String(value), exp });
                return "OK";
            }
            case "del": {
                let n = 0;
                for (const k of args) {
                    if (live(k)) n++;
                    kv.delete(k);
                    sets.delete(k);
                    zsets.delete(k);
                    lists.delete(k);
                }
                return n;
            }
            case "incr":
            case "decr": {
                const e = live(args[0]);
                const n = Number(e?.value ?? 0) + (op === "incr" ? 1 : -1);
                kv.set(args[0], { value: String(n), exp: e?.exp ?? null });
                return n;
            }
            case "expire": {
                const e = live(args[0]);
                if (!e) return 0;
                e.exp = now() + Number(args[1]) * 1000;
                return 1;
            }
            case "ttl": {
                const e = live(args[0]);
                if (!e) return -2;
                return e.exp === null ? -1 : Math.ceil((e.exp - now()) / 1000);
            }
            case "sadd": {
                const s = sets.get(args[0]) ?? new Set();
                const before = s.size;
                for (const m of args.slice(1)) s.add(String(m));
                sets.set(args[0], s);
                return s.size - before;
            }
            case "keys": {
                const glob = String(args[0]).split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"));
                const re = new RegExp(`^${glob.join(".*")}$`);
                return [...kv.keys()].filter((k) => live(k) && re.test(k)).map(b64);
            }
            case "scard":
                return sets.get(args[0])?.size ?? 0;
            case "zadd": {
                const z = zsets.get(args[0]) ?? new Map();
                for (let i = 1; i + 1 < args.length; i += 2) z.set(String(args[i + 1]), Number(args[i]));
                zsets.set(args[0], z);
                return 1;
            }
            case "zrange": {
                const z = [...(zsets.get(args[0]) ?? new Map()).entries()].sort((a, b) => a[1] - b[1]);
                const rev = args.slice(3).some((a) => String(a).toLowerCase() === "rev");
                return (rev ? z.reverse() : z).map(([m]) => b64(m));
            }
            case "zrem": {
                const z = zsets.get(args[0]);
                let n = 0;
                for (const m of args.slice(1)) if (z?.delete(String(m))) n++;
                return n;
            }
            case "rpush": {
                const l = lists.get(args[0]) ?? [];
                l.push(...args.slice(1).map(String));
                lists.set(args[0], l);
                return l.length;
            }
            case "lrange":
                return (lists.get(args[0]) ?? []).map(b64);
            // @upstash/ratelimit's fixed-window script: [count so far, ms until reset]. Always under.
            case "evalsha":
            case "eval":
                return [1, 60_000];
            default:
                throw new Error(`fake upstash: unhandled ${op}`);
        }
    }

    async function handle(input, init = {}) {
        const body = JSON.parse(init.body);
        const path = new URL(String(input)).pathname;
        if (path.endsWith("/pipeline") || path.endsWith("/multi-exec")) {
            return Response.json(body.map((cmd) => ({ result: run(cmd) })));
        }
        return Response.json({ result: run(body) });
    }

    return {
        url,
        kv,
        sets,
        zsets,
        lists,
        commands,
        /** Move the clock every TTL reads, without waiting. */
        advance: (ms) => {
            offset += ms;
        },
        reset() {
            kv.clear();
            sets.clear();
            zsets.clear();
            lists.clear();
            commands.length = 0;
            offset = 0;
        },
        /** For `globalThis.fetch`: true when this request is ours. */
        owns: (input) => String(input).startsWith(url),
        handle,
        get: (key) => live(key)?.value,
    };
}
