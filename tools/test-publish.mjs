// Tests the decision logic behind tools/publish.mjs. Design in
// docs/plans/2026-09-09-publish-command-design.md.
//
// publish.mjs commits and pushes to main, which I cannot exercise from a test,
// so the parts that decide things are pure functions and this covers those. The
// pipeline itself is checked with --dry-run.
//
//   node tools/test-publish.mjs

import { validateMessage, fallbackMessage, isTimestampOnly } from './publish.mjs';

let pass = 0, fail = 0;
const check = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? '  ok   ' : '  FAIL ') + name); };
const head = t => console.log(`\n=== ${t} ===`);

// 1. Message validation, against the four ways the hook actually rejects one
head('1. message validation');
check('accepts a well formed message', validateMessage('fix(foods): pack data for passata').ok);
check('accepts every allowed type', ['feat','fix','docs','refactor','test','chore','build','ci','perf','style']
  .every(t => validateMessage(`${t}(scope): something`).ok));
check('rejects a missing scope', !validateMessage('feat: add thing').ok);
check('rejects empty parens', !validateMessage('feat(): add thing').ok);
check('rejects an unknown type', !validateMessage('wip(foods): add thing').ok);
check('rejects a missing description', !validateMessage('fix(foods): ').ok);
check('rejects no space after the colon', !validateMessage('fix(foods):add thing').ok);

// The hook counts the whole first line, prefix included.
const prefix = 'fix(foods): ';
check('accepts a 72 character subject', validateMessage(prefix + 'x'.repeat(72 - prefix.length)).ok);
check('rejects a 73 character subject', !validateMessage(prefix + 'x'.repeat(73 - prefix.length)).ok);

// The hook greps the whole message, not just the subject, and case insensitively.
check('rejects an attribution trailer', !validateMessage('fix(foods): thing\n\nCo-Authored-By: someone').ok);
check('rejects it lowercased too', !validateMessage('fix(foods): thing\n\nco-authored-by: someone').ok);

check('gives a reason when it rejects', typeof validateMessage('nope').reason === 'string');

// 2. The generated message must never be the thing that breaks the hook
head('2. fallback messages are always valid');
const cases = [
  [],
  ['docs/index.html'],
  ['data/foods.json'],
  ['data/foods.json', 'data/products.json'],
  ['data/foods.json', 'data/products.json', 'data/recipes.json', 'data/rotation.json', 'data/scaffold.json'],
  ['tools/build.mjs'],
  ['tools/build.mjs', 'data/foods.json'],
  ['data/a-very-long-file-name-that-goes-on-and-on-and-on-forever.json',
   'data/another-absurdly-long-one-just-to-be-sure.json'],
];
for (const files of cases) {
  const msg = fallbackMessage(files);
  const v = validateMessage(msg);
  check(`[${files.length} file(s)] -> "${msg}" is valid`, v.ok);
}
check('page-only changes say rebuild', /rebuild/.test(fallbackMessage(['docs/index.html'])));
check('tool changes get a tools scope', /^chore\(tools\)/.test(fallbackMessage(['tools/build.mjs'])));

// 3. Timestamp detection - the distinction that went wrong between #66 and #63
head('3. timestamp-only detection');
const page = n => `<h1>x</h1>\n<p class="week-macro">~${n} kcal</p>\n<footer>Generated from data/ by tools/build.mjs, 2026-09-09 19:17</footer>\n`;
const stamped = t => page(1645).replace('19:17', t);

check('same page, later timestamp -> timestamp only', isTimestampOnly(stamped('19:17'), stamped('19:22')));
check('identical pages -> timestamp only', isTimestampOnly(stamped('19:17'), stamped('19:17')));
check('a macro line moved -> not timestamp only', !isTimestampOnly(page(1625), page(1645)));
check('a macro moved AND the stamp -> not timestamp only',
      !isTimestampOnly(page(1625), page(1645).replace('19:17', '19:22')));
check('handles a page with no footer', typeof isTimestampOnly('<h1>a</h1>', '<h1>b</h1>') === 'boolean');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
