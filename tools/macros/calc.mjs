// Works out the per-portion figures on every recipe card from its ingredient
// list, so the numbers on the page follow from the recipes rather than sitting
// beside them. Run `node tools/macros/calc.mjs` to print the table, or with
// --write to push the results into family-food-system.html.
//
// Every card in the HTML carries data-macro="<id>", and that id is a key in
// recipes.json. Change a recipe, re-run this, and the page catches up.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const foods = JSON.parse(readFileSync(join(here, 'foods.json'), 'utf8'));
const recipes = JSON.parse(readFileSync(join(here, 'recipes.json'), 'utf8'));
const pagePath = join(here, '..', '..', 'family-food-system.html');

const KEYS = ['kcal', 'protein', 'carbs', 'fat', 'fibre'];
const zero = () => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 });

function totals(id, seen = new Set()) {
  if (seen.has(id)) throw new Error(`recipes.json: ${id} includes itself`);
  seen.add(id);
  const r = recipes[id];
  if (!r) throw new Error(`recipes.json: no recipe called ${id}`);
  const out = zero();

  for (const [food, grams] of Object.entries(r.items ?? {})) {
    const row = foods[food];
    if (!row) throw new Error(`${id}: no food called ${food} in foods.json`);
    KEYS.forEach((k, i) => { out[k] += (row[i] * grams) / 100; });
  }

  // Portions pulled out of a shared batch: a twelfth of the chilli pot, a
  // third of the ragu, and so on.
  for (const [source, portions] of r.from ?? []) {
    const per = perPortion(source, seen);
    KEYS.forEach(k => { out[k] += per[k] * portions; });
  }
  return out;
}

function perPortion(id, seen) {
  const t = totals(id, new Set(seen));
  const n = recipes[id].portions;
  return Object.fromEntries(KEYS.map(k => [k, t[k] / n]));
}

// Round the way a recipe card should: calories to the nearest 5, grams to
// whole numbers, and anything under 1g to one decimal place so it doesn't
// silently become zero.
const kcal = v => Math.round(v / 5) * 5;
const g = v => (v < 1 ? Math.round(v * 10) / 10 : Math.round(v));

// A lunch box is a fixed base plus one of five daily finishers, so it has a
// range rather than a figure. Everything else has the same low and high.
function finisherRange(id, base) {
  const days = recipes[id].finishers;
  if (!days) return { lo: base, hi: base };
  const lo = { ...base }, hi = { ...base };
  for (const items of Object.values(days)) {
    const add = zero();
    for (const [food, grams] of Object.entries(items)) {
      const row = foods[food];
      if (!row) throw new Error(`${id}: no food called ${food} in foods.json`);
      KEYS.forEach((k, i) => { add[k] += (row[i] * grams) / 100; });
    }
    KEYS.forEach(k => {
      lo[k] = Math.min(lo[k], base[k] + add[k]);
      hi[k] = Math.max(hi[k], base[k] + add[k]);
    });
  }
  return { lo, hi };
}

const ids = Object.keys(recipes).filter(k => !k.startsWith('_'));
const results = new Map();
for (const id of ids) {
  const { lo, hi } = finisherRange(id, perPortion(id, new Set()));
  const span = (v, w, round) =>
    round(v) === round(w) ? `${round(v)}` : `${round(v)}-${round(w)}`;
  results.set(id, {
    kcal: span(lo.kcal, hi.kcal, kcal),
    protein: span(lo.protein, hi.protein, g),
    carbs: span(lo.carbs, hi.carbs, g),
    fat: span(lo.fat, hi.fat, g),
    fibre: span(lo.fibre, hi.fibre, g),
  });
}

// Extra figures the prose on some cards quotes, worked out the same way.
const extras = {
  '_lunch_box_w2': perPortion('_lunch_box_w2', new Set()),
  '_sandwich_boys': perPortion('_sandwich_boys', new Set()),
  '_w1_chilli_pot': totals('_w1_chilli_pot'),
  '_w2_dal_pot': totals('_w2_dal_pot'),
  '_w3_stew_pot': totals('_w3_stew_pot'),
  '_w4_ragu_pot': totals('_w4_ragu_pot'),
  '_w4_minestrone_pot': totals('_w4_minestrone_pot'),
  'flapjack_tin': totals('flapjack'),
};

const write = process.argv.includes('--write');

if (!write) {
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('card', 18) + ['kcal', 'protein', 'carbs', 'fat', 'fibre'].map(h => pad(h, 9)).join(''));
  for (const [id, m] of results) {
    console.log(pad(id, 18) + KEYS.map(k => pad(m[k], 9)).join(''));
  }
  console.log('\nquoted in the card prose:');
  for (const [id, m] of Object.entries(extras)) {
    console.log(`  ${id}: ${kcal(m.kcal)} kcal, ${g(m.protein)}g protein`);
  }
  process.exit(0);
}

let html = readFileSync(pagePath, 'utf8');
let patched = 0;
for (const [id, m] of results) {
  const re = new RegExp(
    `(<div class="macro" data-macro="${id}">)[^<]*(<em>|</div>)`
  );
  if (!re.test(html)) throw new Error(`${id}: no data-macro="${id}" card in the page`);
  const figures =
    `~${m.kcal} kcal &middot; ${m.protein}g protein &middot; ${m.carbs}g carbs ` +
    `&middot; ${m.fat}g fat &middot; ${m.fibre}g fibre `;
  html = html.replace(re, `$1${figures}$2`);
  patched++;
}
writeFileSync(pagePath, html);
console.log(`patched ${patched} cards in ${pagePath}`);
