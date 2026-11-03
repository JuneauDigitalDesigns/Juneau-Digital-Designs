/**
 * Text alerts can be turned on from every plan.
 *
 * Shipped 2026-11-03, found by the operator on production: the portal's Settings page hid the
 * alerts section for Starter, and the consent route refused the grant for Starter. Two failures
 * came out of that one belief ("Starter has no receptionist, so nothing would ever text"), which
 * the 2026-10-12 reprice made false:
 *
 *  - A Starter owner had no way to opt in to the alerts their plan includes, so the new-lead
 *    text could never reach them.
 *  - On an account holding a Starter and a Growth site, turning alerts on while viewing the
 *    Growth site failed with "not available on the Starter plan". Consent is account-wide; the
 *    route checked one site's plan, and with no `?site=` on the request it read the default
 *    site, which was the Starter one.
 *
 * The route and the component need Clerk and React to run, so this reads their source.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** Source with comment lines dropped, so a comment describing the old gate can't trip the guard. */
const code = (src) =>
  src
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');

test('the consent route does not gate turning alerts on by plan', () => {
  const route = code(read('app/api/portal/sms-consent/route.ts'));
  assert.doesNotMatch(route, /\.plan\b/, 'sms-consent route reads a plan again');
  assert.doesNotMatch(route, /not available on the Starter plan/);
});

test('the Settings alerts section renders on every plan', () => {
  const src = read('app/components/portal/SettingsSection.tsx');
  const start = src.indexOf('function SmsAlertsSection(');
  assert.ok(start >= 0, 'SmsAlertsSection not found');
  // End at a `}` alone on its line: a destructured signature has `}: {` at column 0 too, and
  // stopping there would skip the function body this test exists to read.
  const rest = src.slice(start);
  const end = rest.search(/\r?\n\}\r?\n/);
  assert.ok(end > 0, 'could not find the end of SmsAlertsSection');
  const body = code(rest.slice(0, end));
  assert.doesNotMatch(body, /starter/i, 'SmsAlertsSection branches on Starter again');
  assert.doesNotMatch(body, /return null/, 'SmsAlertsSection can hide itself again');
});
