// I work out the per-portion figures for every recipe from its ingredient list,
// so the numbers on the page follow from the recipes rather than sitting beside
// them. `node tools/calc.mjs` prints the table; build.mjs imports these same
// functions, so the page and the table cannot disagree with each other.
//
// Two ingredient flags matter here:
//   basketOnly  bought for this recipe but not eaten in it (the whole chicken
//               you roast, when only Sunday's share counts against Sunday)
//   macroOnly   eaten here but bought under another recipe (Monday's leftover
//               roast chicken)
// The basket generator in build.mjs reads them the other way round.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');

const read = name => JSON.parse(readFileSync(join(dataDir, name), 'utf8'));

// foods.json is sourced from McCance and Widdowson. products.json holds the
// things M&W has no entry for - supplements, jarred pastes, branded products -
// and those are still estimates until I put pack data in. I merge them into one
// lookup, with foods.json winning if a key ever lands in both.
const products = read('products.json');
const sourced = read('foods.json');
export const foods = { ...products, ...sourced };
export const recipes = read('recipes.json');
export const rotation = read('rotation.json');
export const scaffold = read('scaffold.json');

export const KEYS = ['kcal', 'protein', 'carbs', 'fat', 'fibre'];
const zero = () => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 });

function addFood(acc, food, grams, where) {
  const row = foods[food];
  if (!row) throw new Error(`${where}: no food called ${food} in foods.json or products.json`);
  const per = row.per_100g;
  if (!per) throw new Error(`${where}: ${food} has no per_100g block`);
  KEYS.forEach(k => { acc[k] += ((per[k] ?? 0) * grams) / 100; });
}

// Everything a recipe contains, before I divide by portions. I skip anything
// marked basketOnly, because those are shopping-list entries rather than food
// on the plate.
export function totals(id, seen = new Set()) {
  if (seen.has(id)) throw new Error(`recipes.json: ${id} includes itself`);
  seen.add(id);
  const r = recipes[id];
  if (!r) throw new Error(`recipes.json: no recipe called ${id}`);
  const out = zero();

  for (const ing of r.ingredients ?? []) {
    if (ing.basketOnly) continue;
    addFood(out, ing.food, ing.grams, id);
  }

  // Portions I pull out of another recipe: a twelfth of the chilli pot, two
  // portions of meatballs spread across ten lunch boxes.
  for (const [source, portions] of r.from ?? []) {
    const per = perPortion(source, new Set(seen));
    KEYS.forEach(k => { out[k] += per[k] * portions; });
  }
  return out;
}

export function perPortion(id, seen = new Set()) {
  const t = totals(id, seen);
  const n = recipes[id].serves ?? 1;
  return Object.fromEntries(KEYS.map(k => [k, t[k] / n]));
}

// I round the way a recipe card should: calories to the nearest 5, grams to
// whole numbers, and anything under 1g to one decimal so it does not silently
// vanish on me.
export const roundKcal = v => Math.round(v / 5) * 5;
export const roundG = v => (v < 1 ? Math.round(v * 10) / 10 : Math.round(v));

// A lunch box is a fixed base plus one of five daily finishers, so I give it a
// range rather than a figure. Everything else has the same low and high.
export function finisherRange(id, base) {
  const days = recipes[id].finishers;
  if (!days) return { lo: base, hi: base };
  const lo = { ...base }, hi = { ...base };
  for (const items of Object.values(days)) {
    const add = zero();
    for (const [food, grams] of Object.entries(items)) addFood(add, food, grams, id);
    KEYS.forEach(k => {
      lo[k] = Math.min(lo[k], base[k] + add[k]);
      hi[k] = Math.max(hi[k], base[k] + add[k]);
    });
  }
  return { lo, hi };
}

// A lunch box is no longer one thing: the base is the same all week but the
// protein changes by day, so I give a box five figures rather than one. Base
// plus that day's protein plus that day's finisher, per box.
//
// Monday and Tuesday take their protein from the week's roast tray; the other
// three days each have their own little recipe. I use per-portion figures for
// both, because a tray serving 4 boxes and a pack serving 2 both divide down to
// one box.
export function lunchboxDay(weekId, day) {
  const w = rotation.weeks[weekId];
  const boxId = w.lunchbox;
  const sched = scaffold.lunch_boxes.protein_schedule[day];
  if (!sched) return null;

  const out = perPortion(boxId);
  const proteinId = sched.recipe === 'week' ? w.lunchbox_protein : sched.recipe;
  const protein = perPortion(proteinId);
  KEYS.forEach(k => { out[k] += protein[k]; });

  const finisher = recipes[boxId].finishers?.[day] ?? {};
  for (const [food, grams] of Object.entries(finisher)) addFood(out, food, grams, boxId);

  return { macros: out, proteinId, source: sched.source, notes: sched.notes ?? null };
}

export function lunchboxDayLine(weekId, day, { separator = ' · ' } = {}) {
  const d = lunchboxDay(weekId, day);
  if (!d) return null;
  const m = d.macros;
  return [
    `~${roundKcal(m.kcal)} kcal`,
    `${roundG(m.protein)}g protein`,
    `${roundG(m.carbs)}g carbs`,
    `${roundG(m.fat)}g fat`,
    `${roundG(m.fibre)}g fibre`,
  ].join(separator);
}

// The per-portion figures for one recipe, as strings ready for a card. Recipes
// in the bank with no ingredients yet return null rather than a row of zeroes.
export function macrosFor(id) {
  const r = recipes[id];
  if (!r || r.incomplete || r.alias) return null;
  if (!(r.ingredients?.length || r.from?.length)) return null;

  const { lo, hi } = finisherRange(id, perPortion(id));
  const span = (a, b, round) =>
    round(a) === round(b) ? `${round(a)}` : `${round(a)}-${round(b)}`;
  return {
    kcal:    span(lo.kcal,    hi.kcal,    roundKcal),
    protein: span(lo.protein, hi.protein, roundG),
    carbs:   span(lo.carbs,   hi.carbs,   roundG),
    fat:     span(lo.fat,     hi.fat,     roundG),
    fibre:   span(lo.fibre,   hi.fibre,   roundG),
  };
}

export function macroLine(id, { separator = ' · ' } = {}) {
  const m = macrosFor(id);
  if (!m) return null;
  return [
    `~${m.kcal} kcal`,
    `${m.protein}g protein`,
    `${m.carbs}g carbs`,
    `${m.fat}g fat`,
    `${m.fibre}g fibre`,
  ].join(separator);
}

// Run directly: print the table.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const pad = (s, n) => String(s).padEnd(n);
  const ids = Object.keys(recipes).filter(k => !k.startsWith('_'));
  const done = ids.filter(id => macrosFor(id));
  const skipped = ids.filter(id => !macrosFor(id));

  console.log(pad('recipe', 34) + ['kcal', 'protein', 'carbs', 'fat', 'fibre'].map(h => pad(h, 10)).join(''));
  console.log('-'.repeat(84));
  for (const id of done) {
    const m = macrosFor(id);
    console.log(pad(id, 34) + KEYS.map(k => pad(m[k], 10)).join(''));
  }

  console.log(`\nwhole batches (per pot or tray, not per portion):`);
  for (const id of done.filter(i => (recipes[i].serves ?? 1) > 4)) {
    const t = totals(id);
    console.log(`  ${pad(id, 32)} ${roundKcal(t.kcal)} kcal, ${roundG(t.protein)}g protein, over ${recipes[id].serves} portions`);
  }

  if (skipped.length) {
    console.log(`\nno macros yet (${skipped.length}) - bank recipes waiting on ingredients:`);
    for (const id of skipped) console.log(`  ${id}`);
  }
}
