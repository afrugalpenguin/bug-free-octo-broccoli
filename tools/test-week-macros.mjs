// Tests the weekday macro summary - the line at the top of every week saying
// what an average day looks like. Design in docs/plans/2026-09-09-weekday-macro-summary-design.md.
//
// The things worth testing here are the silent failures. A dinner recipe going
// incomplete makes perPortion return zeroes, so the average sags instead of
// breaking. A missing protein_schedule day makes lunchboxDay return null, so
// lunch vanishes. Neither would look wrong on the page. So most of these check
// that the number is made of what I think it is made of.
//
//   node tools/build.mjs && node tools/test-week-macros.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { KEYS, recipes, rotation, scaffold, perPortion, lunchboxDay,
         weekdayAverage, weekdayAverageLine } from './calc.mjs';

let pass = 0, fail = 0;
const check = (name, cond) => { cond ? pass++ : fail++; console.log((cond ? '  ok   ' : '  FAIL ') + name); };
const head = t => console.log(`\n=== ${t} ===`);

const WEEKS = Object.keys(rotation.weeks);
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

// 1. Every week produces a real figure
head('1. every week averages');
for (const w of WEEKS) {
  const m = weekdayAverage(w);
  const ok = KEYS.every(k => Number.isFinite(m[k]) && m[k] > 0);
  check(`week ${w}: five finite non-zero macros`, ok);
}

// 2. Friday's dinner is actually in there.
//
// Friday is scaffold:pizza and needs its own branch - the adults' topping plus
// the salad. If that branch ever stops matching, the average would quietly drop
// about a thousand calories and still look plausible, so I compare against the
// same sum with Friday's dinner left out.
head('2. friday is counted');
for (const w of WEEKS) {
  const withFriday = weekdayAverage(w);
  const bfast = perPortion(scaffold.breakfast_bags.recipe);
  const without = Object.fromEntries(KEYS.map(k => [k, 0]));
  for (const day of WEEKDAYS) {
    const lb = lunchboxDay(w, day);
    const id = rotation.weeks[w].dinners[day];
    const isPizza = id === 'scaffold:pizza';
    for (const k of KEYS) {
      without[k] += bfast[k] + (lb ? lb.macros[k] : 0) + (isPizza ? 0 : perPortion(id)[k]);
    }
  }
  for (const k of KEYS) without[k] /= WEEKDAYS.length;
  check(`week ${w}: average exceeds the same week without friday's dinner`,
        withFriday.kcal > without.kcal + 100);
}

// 3. The parts add up - nothing double counted, nothing dropped
head('3. the parts sum to the whole');
for (const w of WEEKS) {
  const expected = Object.fromEntries(KEYS.map(k => [k, 0]));
  const bfast = perPortion(scaffold.breakfast_bags.recipe);
  for (const day of WEEKDAYS) {
    const lb = lunchboxDay(w, day);
    const id = rotation.weeks[w].dinners[day];
    const din = id === 'scaffold:pizza'
      ? (() => {
          const p = perPortion(rotation.weeks[w].friday_pizza_topping);
          const s = perPortion(rotation.weeks[w].friday_salad);
          return Object.fromEntries(KEYS.map(k => [k, p[k] + s[k]]));
        })()
      : perPortion(id);
    for (const k of KEYS) expected[k] += bfast[k] + (lb ? lb.macros[k] : 0) + din[k];
  }
  for (const k of KEYS) expected[k] /= WEEKDAYS.length;
  const got = weekdayAverage(w);
  const same = KEYS.every(k => Math.abs(got[k] - expected[k]) < 0.001);
  check(`week ${w}: breakfast + lunchbox + dinner, over five days`, same);
}

// 4. Lunch is really in the number.
//
// lunchboxDay returns null for a day with no protein_schedule entry, and a null
// lunch would just quietly shrink the average.
head('4. lunch is present every weekday');
for (const day of WEEKDAYS) {
  check(`${day}: has a lunchbox`, lunchboxDay(WEEKS[0], day) !== null);
}

// 5. The formatted line
head('5. the line reads properly');
for (const w of WEEKS) {
  const line = weekdayAverageLine(w);
  check(`week ${w}: line carries all five macros`,
        /kcal/.test(line) && /protein/.test(line) && /carbs/.test(line)
        && /fat/.test(line) && /fibre/.test(line));
}

// 6. It reaches the built page
head('6. it reaches the page');
const page = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html');
const html = readFileSync(page, 'utf8');
const found = html.match(/class="week-macro"/g) ?? [];
check(`one week-macro per week (${found.length} of ${WEEKS.length})`, found.length === WEEKS.length);
check('the rendered line carries a kcal figure', /class="week-macro"[\s\S]{0,200}?kcal/.test(html));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
