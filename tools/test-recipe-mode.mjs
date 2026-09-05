// Tests the recipe-mode wake lock, by pulling the block straight out of the
// built docs/index.html and running it against a stub browser. It tests what
// actually ships rather than a copy of it, so run tools/build.mjs first.
//
// The lock is fiddly in ways that are easy to get wrong and impossible to
// notice by looking: the browser drops it every time the page hides, battery
// saver refuses it outright, and neither must leave the mode wedged. That is
// what most of these check.
//
//   node tools/build.mjs && node tools/test-recipe-mode.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const page = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html');

const html = readFileSync(page, 'utf8');
const js   = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const from = js.indexOf("var cookBtn = document.getElementById('recipe-mode');");
const to   = js.indexOf('applySettings();', from);
if (from < 0 || to < 0) throw new Error('could not find the recipe-mode block - has build.mjs been run?');
const block = js.slice(from, to);

function run({ hasApi = true, saved = null, requestFails = false }) {
  const log = [];
  let released = null;
  const btn = {
    hidden: true, title: '', attrs: {}, classes: new Set(), handlers: {},
    classList: { toggle(c, on) { on ? btn.classes.add(c) : btn.classes.delete(c); } },
    setAttribute(k, v) { btn.attrs[k] = v; },
    addEventListener(ev, fn) { btn.handlers[ev] = fn; },
  };
  const docHandlers = {};
  const document = {
    getElementById: () => btn,
    visibilityState: 'visible',
    addEventListener: (ev, fn) => { docHandlers[ev] = fn; },
  };
  const navigator = hasApi ? {
    wakeLock: {
      request(kind) {
        log.push('request:' + kind);
        if (requestFails) return Promise.reject(new Error('denied'));
        const l = { addEventListener: (e, fn) => { released = fn; },
                    release: () => { log.push('release'); return Promise.resolve(); } };
        return Promise.resolve(l);
      },
    },
  } : {};
  const mem = new Map(saved === null ? [] : [['ffs-recipe-mode', saved]]);
  const store = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };

  const fn = new Function('document', 'navigator', 'store', 'COOK_KEY', block);
  fn(document, navigator, store, 'ffs-recipe-mode');
  return { btn, log, docHandlers, mem, fireRelease: () => released && released() };
}

const tick = () => new Promise(r => setTimeout(r, 0));
let pass = 0, fail = 0;
const check = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? '  ok   ' : '  FAIL ') + name); };

// 1. No API at all
{
  const { btn } = run({ hasApi: false });
  check('no Wake Lock: button stays hidden', btn.hidden === true);
}

// 2. Fresh visit, nothing saved
{
  const { btn, log } = run({});
  await tick();
  check('fresh: button is shown', btn.hidden === false);
  check('fresh: mode is off', !btn.classes.has('on'));
  check('fresh: no lock taken', log.length === 0);
  check('fresh: aria-pressed false', btn.attrs['aria-pressed'] === 'false');
}

// 3. Toggling on and off
{
  const { btn, log, mem } = run({});
  await tick();
  btn.handlers.click(); await tick();
  check('click on: lock requested', log[0] === 'request:screen');
  check('click on: painted on', btn.classes.has('on'));
  check('click on: aria-pressed true', btn.attrs['aria-pressed'] === 'true');
  check('click on: remembered', mem.get('ffs-recipe-mode') === '1');
  btn.handlers.click(); await tick();
  check('click off: lock released', log.includes('release'));
  check('click off: painted off', !btn.classes.has('on'));
  check('click off: remembered', mem.get('ffs-recipe-mode') === '0');
}

// 4. Comes back on after a reload mid-cook
{
  const { btn, log } = run({ saved: '1' });
  await tick();
  check('saved on: painted on', btn.classes.has('on'));
  check('saved on: lock retaken', log[0] === 'request:screen');
}

// 5. The lock is dropped when the page hides, and retaken on return
{
  const { log, docHandlers, fireRelease } = run({ saved: '1' });
  await tick();
  check('hide/show: one lock so far', log.filter(x => x.startsWith('request')).length === 1);
  fireRelease();                                  // browser drops it on hide
  docHandlers.visibilitychange();                 // still 'visible' in the stub
  await tick();
  check('hide/show: retaken on return', log.filter(x => x.startsWith('request')).length === 2);
}

// 6. A refused request must not wedge the mode
{
  const { btn, log, docHandlers } = run({ saved: '1', requestFails: true });
  await tick();
  check('refused: mode stays on', btn.classes.has('on'));
  docHandlers.visibilitychange(); await tick();
  check('refused: retries on next visibility', log.filter(x => x.startsWith('request')).length === 2);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
