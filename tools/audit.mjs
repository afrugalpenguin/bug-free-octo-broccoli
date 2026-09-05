// I check the data for the mistakes I keep making by hand. Read-only, it
// changes nothing. I run it with `node tools/audit.mjs` after editing data/.
//
// FAIL means something is broken and I should fix it. WARN needs my judgement -
// mostly a quantity named in one recipe's prose that belongs to another, which
// is legitimate and which this cannot tell apart from a number I left stale.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { recipes, foods, rotation, scaffold } from './calc.mjs';

let problems = 0;
const say = (tag, msg) => { console.log(`  ${tag} ${msg}`); if (tag === 'FAIL') problems++; };
const head = t => console.log(`\n=== ${t} ===`);

const R = Object.entries(recipes).filter(([, r]) => typeof r === 'object');

// ---------------------------------------------------------- 1. integrity
head('1. referential integrity');
let bad = 0;
for (const [id, r] of R) {
  for (const i of r.ingredients ?? []) {
    if (!foods[i.food]) { say('FAIL', `${id}: no food "${i.food}"`); bad++; }
    if (typeof i.grams !== 'number' || i.grams <= 0) { say('FAIL', `${id}: bad grams on ${i.food}`); bad++; }
    if (i.basketOnly && i.macroOnly) { say('FAIL', `${id}: ${i.food} is both basketOnly and macroOnly`); bad++; }
    if (!i.aisle) { say('FAIL', `${id}: ${i.food} has no aisle`); bad++; }
  }
  for (const [src] of r.from ?? []) if (!recipes[src]) { say('FAIL', `${id}: from -> missing "${src}"`); bad++; }
  if (r.alias && !recipes[r.alias]) { say('FAIL', `${id}: alias -> missing "${r.alias}"`); bad++; }
  if (r.serves != null && (typeof r.serves !== 'number' || r.serves <= 0)) { say('FAIL', `${id}: serves ${r.serves}`); bad++; }
}
for (const [wk, w] of Object.entries(rotation.weeks)) {
  const slots = { roast: w.roast, traybake: w.traybake, batch_pot: w.batch_pot, extra_pot: w.extra_pot,
    freezer_bag: w.freezer_bag, lunchbox: w.lunchbox, lunchbox_protein: w.lunchbox_protein,
    lunchbox_veg_tray: w.lunchbox_veg_tray, lunchbox_dressing: w.lunchbox_dressing,
    flapjack: w.flapjack, friday_salad: w.friday_salad, friday_pizza_topping: w.friday_pizza_topping };
  for (const [k, id] of Object.entries(slots)) if (id && !recipes[id]) { say('FAIL', `week ${wk} ${k} -> missing "${id}"`); bad++; }
  for (const [d, id] of Object.entries(w.dinners)) if (id !== 'scaffold:pizza' && !recipes[id]) { say('FAIL', `week ${wk} ${d} -> missing "${id}"`); bad++; }
}
if (!bad) say('ok  ', 'every food key, from link, alias and rotation slot resolves');

// ------------------------------------------------- 2. baskets, all weeks x cycles
head('2. baskets - every week, both cycles');
function plan(wk, cycle) {
  const w = rotation.weeks[wk];
  const bags = cycle === 1 ? scaffold.freezer_bank.cycle_1.weekly_bags : scaffold.freezer_bank.cycle_2_onwards.weekly_bags;
  const p = []; const add = (id, n = 1) => { if (id && recipes[id]) p.push({ id, n }); };
  add(w.flapjack); add(w.lunchbox_dressing); add(w.lunchbox_protein); add(w.lunchbox_veg_tray);
  add(w.lunchbox, scaffold.lunch_boxes.total); add(w.batch_pot); add(w.extra_pot); add(w.traybake); add(w.roast);
  for (const d of ['mon', 'tue', 'wed']) add(w.dinners[d]);
  add(w.freezer_bag, bags);
  add(scaffold.friday_pizza.boys.recipe); add(w.friday_pizza_topping); add(w.friday_salad);
  add('sandwiches_adults', 2); add('sandwiches_boys', 2);
  add('tuna_pasta_salad'); add('boiled_eggs'); add('quick_pickled_red_onions');
  add(scaffold.breakfast_bags.recipe, scaffold.breakfast_bags.count);
  add(scaffold.packed_lunch.recipe);
  for (const d of Object.values(scaffold.lunch_boxes.protein_schedule)) if (d.recipe !== 'week') add(d.recipe);
  return p;
}
// The boiled eggs need care: I buy 12 and eat 12, and the salads then eat their
// share of those same 12 again as macroOnly. If I do not net that off, every
// week looks short on eggs when it is not.
const EGG_BATCH_COVERS = ['tuna_pasta_salad', 'chopped_salad_w1', 'cucumber_tomato_salad_w2', 'greek_salad_w3', 'tomato_mozzarella_salad_w4'];
for (const wk of ['1', '2', '3', '4']) for (const cycle of [1, 2]) {
  const buy = new Map(), eat = new Map();
  for (const { id, n } of plan(wk, cycle)) for (const i of recipes[id].ingredients ?? []) {
    if (!i.macroOnly) buy.set(i.food, (buy.get(i.food) ?? 0) + i.grams * n);
    if (!i.basketOnly) {
      if (i.food === 'egg' && EGG_BATCH_COVERS.includes(id)) continue;   // comes out of the batch
      eat.set(i.food, (eat.get(i.food) ?? 0) + i.grams * n);
    }
  }
  const missing = [...eat].filter(([f]) => !buy.has(f));
  const short = [...eat].filter(([f, g]) => buy.has(f) && g > buy.get(f) * 1.02 && g - buy.get(f) > 20);
  if (missing.length || short.length) {
    say('FAIL', `week ${wk} cycle ${cycle}: ` +
      (missing.length ? 'missing ' + missing.map(([f, g]) => `${f} ${g}g`).join(', ') : '') +
      (short.length ? ' short ' + short.map(([f, g]) => `${f} eats ${g}g buys ${buy.get(f)}g`).join(', ') : ''));
  }
}
if (!problems) say('ok  ', 'all 8 week/cycle baskets buy everything that gets eaten');

// ------------------------------------- 3. numbers in prose vs numbers in data
head('3. quantities named in prose that the ingredients do not back up');
const NUM = /(\d+(?:\.\d+)?)\s*(kg|g)\b/gi;
let prose = 0;
for (const [id, r] of R) {
  const text = [r.notes, ...(r.method ?? []), ...Object.values(r.basket_notes ?? {})].filter(Boolean).join(' ');
  if (!text) continue;
  const grams = new Set();
  for (const i of r.ingredients ?? []) { grams.add(i.grams); grams.add(i.grams * (r.serves ?? 1)); }
  for (const [, n, unit] of text.matchAll(NUM)) {
    const v = unit.toLowerCase() === 'kg' ? parseFloat(n) * 1000 : parseFloat(n);
    if (v < 40) continue;                                   // spoons, small spices
    const near = [...grams].some(g => Math.abs(g - v) <= Math.max(25, g * 0.12));
    if (!near) { say('WARN', `${id}: prose says ${n}${unit}, ingredients have ${[...grams].filter(g => g >= 40).sort((a, b) => a - b).join(', ')}`); prose++; }
  }
}
if (!prose) say('ok  ', 'every weight named in prose matches an ingredient');

// ----------------------------------------------------- 4. orphans and reach
head('4. recipes nothing reaches');
const reached = new Set();
const walk = id => { if (!id || reached.has(id) || !recipes[id]) return; reached.add(id);
  for (const [src] of recipes[id].from ?? []) walk(src);
  if (recipes[id].alias) walk(recipes[id].alias); };
for (const wk of ['1', '2', '3', '4']) for (const { id } of plan(wk, 1)) walk(id);
walk(scaffold.friday_pizza.boys.recipe);
for (const [id, r] of R) if (r.bucket || r.classification) reached.add(id);   // bank
const orphans = R.map(([id]) => id).filter(id => !reached.has(id));
orphans.length ? say('WARN', 'unreachable: ' + orphans.join(', ')) : say('ok  ', 'every recipe is reachable');

// ------------------------------------------------------- 5. scaffold wiring
head('5. scaffold references');
let sc = 0;
for (const [k, v] of Object.entries(scaffold)) {
  if (v && typeof v === 'object' && v.recipe && !recipes[v.recipe]) { say('FAIL', `scaffold.${k}.recipe -> missing "${v.recipe}"`); sc++; }
}
for (const [d, s] of Object.entries(scaffold.lunch_boxes.protein_schedule))
  if (s.recipe !== 'week' && !recipes[s.recipe]) { say('FAIL', `protein_schedule.${d} -> missing "${s.recipe}"`); sc++; }
if (!scaffold.defaults.delivery_days_allowed.includes(scaffold.defaults.delivery_day)) { say('FAIL', 'default delivery_day is not in delivery_days_allowed'); sc++; }
if (!sc) say('ok  ', 'every scaffold recipe reference resolves');

// ------------------------------------------------------------ 6. dead data
head('6. dead keys');

// build.mjs keeps a COUNTED table saying which foods I buy by the unit and
// what one unit weighs. A key in there that names no food is silent: the
// basket just falls back to weight and asks me for "40g chicken stock cubes"
// instead of 4 of them. That is what a rename did to `stock_cube`, and it went
// unnoticed for months. So I read the table out of build.mjs by text - the
// same trick test-recipe-mode.mjs uses on the built page - rather than
// importing it, because importing build.mjs would rebuild the site.
const buildSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'build.mjs'), 'utf8');
const countedBlock = buildSrc.match(/const COUNTED = \{([\s\S]*?)\n\};/);
const counted = new Set();
if (!countedBlock) say('FAIL', 'could not find COUNTED in build.mjs - has it been renamed?');
else for (const [, k] of countedBlock[1].matchAll(/^\s{2}(\w+):\s*\[/gm)) counted.add(k);
const orphanCounted = [...counted].filter(k => !foods[k]);
orphanCounted.length
  ? say('FAIL', `COUNTED names foods that do not exist: ${orphanCounted.join(', ')}`)
  : say('ok  ', `all ${counted.size} COUNTED keys name a real food`);

const usedFoods = new Set(counted);   // a counted food is bought even if nothing eats it
for (const [, r] of R) { for (const i of r.ingredients ?? []) usedFoods.add(i.food);
  for (const f of Object.values(r.finishers ?? {})) Object.keys(f).forEach(k => usedFoods.add(k)); }
const deadFoods = Object.keys(foods).filter(k => !k.startsWith('_') && !usedFoods.has(k));
say('WARN', `${deadFoods.length} unused foods: ${deadFoods.join(', ') || 'none'}`);

console.log(`\n${problems ? problems + ' FAILURES' : 'no failures'} - warnings above are for judgement, not bugs`);
