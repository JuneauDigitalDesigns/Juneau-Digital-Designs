/**
 * A Clerk whose invitations a test can count. `globalThis.__clerk` holds the calls; registered by
 * the test that needs it.
 */
const STUB = `
export const clerkClient = async () => ({
  users: { getUserList: async () => ({ data: [] }) },
  invitations: {
    createInvitation: async (args) => {
      const n = ++globalThis.__clerk.created;
      await new Promise((r) => setTimeout(r, 40));
      return { id: "inv_" + n, url: "https://clerk.test/ticket/" + n };
    },
  },
});
export const auth = () => { throw new Error("auth must not be reached"); };
`;

export async function resolve(specifier, context, next) {
    if (specifier === "@clerk/nextjs/server") {
        return { url: `data:text/javascript,${encodeURIComponent(STUB)}`, format: "module", shortCircuit: true };
    }
    return next(specifier, context);
}
