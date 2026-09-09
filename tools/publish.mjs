// One command: audit, build, test, commit, push. Pages does the rest.
//
//   node tools/publish.mjs
//   node tools/publish.mjs "fix(foods): pack data for passata"
//   node tools/publish.mjs --dry-run
//
// This goes straight to main rather than through a branch and a PR, which is
// deliberate. I am not reviewing my own data changes, so a PR would be a rubber
// stamp on numbers I have not read - the audit is what actually checks
// anything, and this refuses to publish past it.
//
// Design: docs/plans/2026-09-09-publish-command-design.md

import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ------------------------------------------------------------ decisions
// These three are pure and exported so tools/test-publish.mjs can cover them
// without touching git. Everything below them is side effects.

// The authority is ~/.git-hooks/commit-msg and this mirrors it. If the two ever
// drift, the hook wins and I would rather find out here than after a build, so
// the test asserts against the same rule.
const TYPES = ['feat', 'fix', 'docs', 'refactor', 'test', 'chore', 'build', 'ci', 'perf', 'style'];
const SUBJECT = new RegExp(String.raw`^(${TYPES.join('|')})\(.+\): .+`);
// Assembled rather than written out, so the string itself never appears in a
// commit message I generate from this file.
const TRAILER = new RegExp(['co', 'authored', 'by:'].join('-'), 'i');

export function validateMessage(msg) {
  if (typeof msg !== 'string' || !msg.trim()) return { ok: false, reason: 'empty message' };
  if (TRAILER.test(msg)) return { ok: false, reason: 'the hook rejects an attribution trailer' };
  const first = msg.split('\n')[0];
  if (!SUBJECT.test(first)) {
    return { ok: false, reason: `not "type(scope): description" - types are ${TYPES.join(', ')}` };
  }
  if (first.length > 72) return { ok: false, reason: `subject is ${first.length} characters, max 72` };
  return { ok: true };
}

// A message derived from what changed. It has to satisfy the hook too - a
// generated message that fails my own commit hook would be a silly way to lose
// a publish - so anything that would not fit falls back to something that does.
export function fallbackMessage(changed) {
  const files = changed ?? [];
  if (files.some(f => f.startsWith('tools/'))) return 'chore(tools): update the build';

  const data = files.filter(f => f.startsWith('data/'))
    .map(f => f.replace(/^data\//, '').replace(/\.json$/, ''));
  if (!data.length) return 'chore(data): rebuild the page';

  const msg = `chore(data): update ${data.join(', ')}`;
  return validateMessage(msg).ok ? msg : 'chore(data): update the data';
}

// build.mjs stamps the footer every run, so an unchanged page still looks
// changed. Comparing without that line is what tells a real change from churn -
// the distinction I got wrong between #66 and #63, which put stale macros on a
// live site.
const FOOTER = /<footer>Generated from data\/ by tools\/build\.mjs,[^<]*<\/footer>/;
export function isTimestampOnly(before, after) {
  return before.replace(FOOTER, '') === after.replace(FOOTER, '');
}

// -------------------------------------------------------------- plumbing

const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const gitOut = (...args) => git(...args).stdout.trim();

function step(label, cmd, args) {
  console.log(`\n> ${label}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`\n${label} failed. Nothing committed.`);
    process.exit(1);
  }
}

const die = msg => { console.error(`\n${msg}`); process.exit(1); };

// Tracked modifications only. Untracked files are never staged, so a scratch
// file in the working tree cannot ride along into a publish.
function changedFiles() {
  return gitOut('status', '--porcelain')
    .split('\n')
    .filter(Boolean)
    .filter(l => !l.startsWith('??'))
    .map(l => l.slice(3).trim());
}

const ALLOWED = ['data/', 'docs/', 'tools/'];

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const given = args.find(a => a !== '--dry-run');

  // ---- preflight, before any work
  const branch = gitOut('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch !== 'main') die(`on branch "${branch}" - publish only runs from main.`);

  if (given) {
    const v = validateMessage(given);
    if (!v.ok) die(`that message will not pass the commit hook: ${v.reason}`);
  }

  const stray = changedFiles().filter(f => !ALLOWED.some(p => f.startsWith(p)));
  if (stray.length) {
    die(`modified outside data/, docs/ and tools/:\n  ${stray.join('\n  ')}\n\nCommit those separately first.`);
  }

  step('pulling main', 'git', ['pull', '--ff-only', 'origin', 'main']);
  step('auditing the data', 'node', ['tools/audit.mjs']);
  step('building the page', 'node', ['tools/build.mjs']);
  step('testing the macro summary', 'node', ['tools/test-week-macros.mjs']);
  step('testing recipe mode', 'node', ['tools/test-recipe-mode.mjs']);

  // ---- what actually changed
  const head = git('show', 'HEAD:docs/index.html').stdout ?? '';
  const now = git('show', ':docs/index.html').stdout ?? '';
  const built = spawnSync('cat', ['docs/index.html'], { cwd: root, encoding: 'utf8' }).stdout ?? now;

  if (head && isTimestampOnly(head, built)) {
    git('checkout', '--', 'docs/index.html');
    console.log('\n  page unchanged apart from the build timestamp - reverted it');
  }

  const changed = changedFiles();
  if (!changed.length) {
    console.log('\nNothing to publish - the site already matches the data.');
    return;
  }

  const message = given ?? fallbackMessage(changed);
  const v = validateMessage(message);
  if (!v.ok) die(`generated message is invalid (${v.reason}): ${message}`);

  console.log(`\nPublishing ${changed.length} file(s):`);
  changed.forEach(f => console.log(`  ${f}`));
  console.log(`\n  ${message}`);

  if (dryRun) {
    console.log('\n--dry-run: stopping before commit and push.');
    return;
  }

  step('committing', 'git', ['add', ...ALLOWED.map(p => p.replace(/\/$/, ''))]);
  step('committing', 'git', ['commit', '-m', message]);
  step('pushing to main', 'git', ['push', 'origin', 'main']);

  console.log('\nLive shortly at https://afrugalpenguin.github.io/bug-free-octo-broccoli/');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
