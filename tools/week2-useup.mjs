// One-off generator for docs/week2-freezer.html.
//
// This is week 2 as normal, with the freezer use-up substitutions applied, so
// the page can be cooked and shopped from on its own rather than being a diff
// you hold in your head against the main site.
//
// It is deliberately NOT part of tools/build.mjs. Delete this file and the page
// it writes when the week is done, and nothing else changes.
//
// The macro maths is duplicated from calc.mjs rather than imported, because
// calc.mjs closes over the real recipes and foods and this script needs to
// compute against patched ones.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const read = f => JSON.parse(readFileSync(join(dataDir, f), 'utf8'));

const foods     = read('foods.json');
const recipes   = read('recipes.json');
const rotation  = read('rotation.json');
const scaffold  = read('scaffold.json');

const WEEK = '2';
const CYCLE = 1;                       // double freezer bags this cycle

// --------------------------------------------------------------- the changes

// Foods that only exist for this week. Not added to foods.json - when the page
// goes, they go with it.
Object.assign(foods, {
  basa_fillet: [90, 15.0, 0, 3.0, 0],
  edamame:     [122, 11.0, 9.0, 5.0, 5.0],
  mini_corn:   [30, 2.0, 5.0, 0.3, 2.0],
});

// What is already in the freezer, and how much. The basket subtracts these and
// only asks you to buy the shortfall.
const FREEZER = {
  basa_fillet:      480,
  salmon_fillet:    130,
  mini_corn:        300,
  prawns_cooked:    180,
  frozen_berries:  1900,
  frozen_peas:     1000,
  edamame:          500,
  sweetcorn_drained: 300,
  chicken_thigh_boneless: 800,
};

// Recipe patches. Each gets the real recipe and returns the changed one.
const OVERRIDES = {
  salmon_traybake_glazed: r => ({
    ...r,
    name: 'Glazed Basa & Salmon Traybake',
    notes: 'Freezer version. Basa cooks faster than salmon, so it goes in later.',
    ingredients: [
      { food: 'basa_fillet', grams: 480, display: '4 basa fillets (from freezer)', aisle: 'fish' },
      { food: 'salmon_fillet', grams: 130, display: '1 salmon fillet (from freezer)', aisle: 'fish' },
      { food: 'mini_corn', grams: 300, display: '300g mini corn cobs (from freezer)', aisle: 'frozen' },
      ...r.ingredients.filter(i => i.food !== 'salmon_fillet'),
    ],
    method: [
      'Potatoes and mini corn cobs in first, 200C, 20 minutes.',
      'Broccoli and tomatoes in, glaze whisked and brushed over the fish.',
      'Fish on top. Basa needs 12-15 minutes, not the 15-20 salmon wants - watch it, it goes from done to dry quickly.',
      'Herbs and lemon over at the table.',
    ],
  }),

  pork_fried_rice: r => ({
    ...r,
    notes: 'Freezer version. Make the lot at the first sitting, microwave per person after.',
    ingredients: [
      ...r.ingredients.filter(i => i.food !== 'stir_fry_veg'),
      { food: 'sweetcorn_drained', grams: 300, display: '300g sweetcorn (from freezer)', aisle: 'frozen' },
      { food: 'edamame', grams: 200, display: '200g edamame (from freezer)', aisle: 'frozen' },
      { food: 'frozen_peas', grams: 100, display: '100g peas (from freezer)', aisle: 'frozen' },
    ],
  }),

  // A spoonful of edamame in every box, for the protein.
  lunchbox_w2: r => ({
    ...r,
    ingredients: [
      ...r.ingredients,
      { food: 'edamame', grams: 30, display: 'A spoonful of edamame (from freezer)', aisle: 'frozen' },
    ],
  }),
};

// One lunch box finisher swaps to the week 1 sweetcorn and coriander.
const FINISHER_OVERRIDES = { wed: '60g sweetcorn and chopped coriander' };
const FINISHER_MACRO_OVERRIDES = { wed: { sweetcorn_drained: 60, fresh_herbs: 5 } };

const SWAPS = [
  ['Salmon traybake', '4 basa fillets and 1 salmon from the freezer, plus 300g mini corn cobs on the tray. Basa cooks 12-15 minutes, not 15-20.'],
  ['Wednesday fried rice', '300g sweetcorn, 200g edamame and 100g peas from the freezer instead of the bagged stir fry veg.'],
  ['Thursday lunch boxes', 'Prawns from the freezer. Defrost Wednesday night.'],
  ['Breakfast bags', 'Berries from the freezer. Mix it up: blueberry, raspberry, mango, mixed berry.'],
  ['All lunch boxes', 'A spoonful of edamame in each, about 30g. Extra protein.'],
  ['Tuna pasta salad', 'Peas from the freezer.'],
  ['Wednesday finisher', 'Sweetcorn and coriander, as in week 1.'],
  ['Chicken thighs', '800g from the freezer. Use it before opening anything bought - defrost Thursday night.'],
];

// ------------------------------------------------------------- macro engine

const KEYS = ['kcal', 'protein', 'carbs', 'fat', 'fibre'];
const zero = () => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 });
const R = id => (OVERRIDES[id] ? OVERRIDES[id](recipes[id]) : recipes[id]);

function addFood(acc, food, grams, where) {
  const row = foods[food];
  if (!row) throw new Error(`${where}: no food called ${food}`);
  KEYS.forEach((k, i) => { acc[k] += (row[i] * grams) / 100; });
}

function totals(id, seen = new Set()) {
  if (seen.has(id)) throw new Error(`${id} includes itself`);
  seen.add(id);
  const r = R(id);
  const out = zero();
  for (const ing of r.ingredients ?? []) {
    if (ing.basketOnly) continue;
    addFood(out, ing.food, ing.grams, id);
  }
  for (const [src, n] of r.from ?? []) {
    const per = perPortion(src, new Set(seen));
    KEYS.forEach(k => { out[k] += per[k] * n; });
  }
  return out;
}

function perPortion(id, seen = new Set()) {
  const t = totals(id, seen);
  const n = R(id).serves ?? 1;
  return Object.fromEntries(KEYS.map(k => [k, t[k] / n]));
}

const roundKcal = v => Math.round(v / 5) * 5;
const roundG = v => (v < 1 ? Math.round(v * 10) / 10 : Math.round(v));

function macroLine(id) {
  const r = R(id);
  if (r.incomplete || r.alias) return null;
  if (!(r.ingredients?.length || r.from?.length)) return null;
  const m = perPortion(id);
  return `~${roundKcal(m.kcal)} kcal · ${roundG(m.protein)}g protein · ${roundG(m.carbs)}g carbs · ${roundG(m.fat)}g fat · ${roundG(m.fibre)}g fibre`;
}

// The five lunch box days: base + that day's protein + that day's finisher.
function lunchboxDay(day) {
  const w = rotation.weeks[WEEK];
  const sched = scaffold.lunch_boxes.protein_schedule[day];
  const out = perPortion(w.lunchbox);
  const proteinId = sched.recipe === 'week' ? w.lunchbox_protein : sched.recipe;
  const per = perPortion(proteinId);
  KEYS.forEach(k => { out[k] += per[k]; });
  const fin = FINISHER_MACRO_OVERRIDES[day] ?? R(w.lunchbox).finishers?.[day] ?? {};
  for (const [food, grams] of Object.entries(fin)) addFood(out, food, grams, w.lunchbox);
  return { macros: out, proteinId, grams: sched.grams,
           when: sched.recipe === 'week' ? 'in on Saturday' : 'in on the day' };
}

// ------------------------------------------------------------------ basket

const DAYS = rotation.day_order;
const DAY_NAME = rotation.day_names;
const AISLES = [['meat','Meat'],['fish','Fish'],['dairy','Dairy'],['bakery','Bakery'],
                ['fresh','Fruit &amp; Veg'],['frozen','Frozen'],['tinned','Tinned'],['cupboard','Cupboard']];

function basketPlan() {
  const w = rotation.weeks[WEEK];
  const bags = CYCLE === 1 ? scaffold.freezer_bank.cycle_1.weekly_bags
                           : scaffold.freezer_bank.cycle_2_onwards.weekly_bags;
  const plan = [];
  const add = (id, n = 1) => { if (id && recipes[id]) plan.push({ id, n }); };
  add(w.flapjack); add(w.lunchbox_dressing); add(w.lunchbox_protein); add(w.lunchbox_veg_tray);
  add(w.lunchbox, scaffold.lunch_boxes.total);
  add(w.batch_pot); add(w.extra_pot); add(w.traybake); add(w.roast);
  for (const d of ['mon', 'tue', 'wed']) add(w.dinners[d]);
  add(w.freezer_bag, bags);
  add(scaffold.friday_pizza.boys.recipe); add(w.friday_pizza_topping); add(w.friday_salad);
  add('sandwiches_adults', 2); add('sandwiches_boys', 2);
  add('tuna_pasta_salad'); add('boiled_eggs'); add('quick_pickled_red_onions');
  add(scaffold.breakfast_bags.recipe, scaffold.breakfast_bags.count);
  for (const d of Object.values(scaffold.lunch_boxes.protein_schedule)) if (d.recipe !== 'week') add(d.recipe);
  return plan;
}

function buildBasket() {
  const items = new Map();
  for (const { id, n } of basketPlan()) {
    const r = R(id);
    for (const ing of r.ingredients ?? []) {
      if (ing.macroOnly) continue;
      const cur = items.get(ing.food) ?? { food: ing.food, aisle: ing.aisle, grams: 0, uses: [] };
      cur.grams += ing.grams * n;
      cur.uses.push({ recipe: r.name, display: ing.display, n });
      items.set(ing.food, cur);
    }
  }
  // Take the freezer stock off the top; only the shortfall gets bought.
  const fromFreezer = [];
  for (const it of items.values()) {
    const have = FREEZER[it.food];
    if (!have) continue;
    const used = Math.min(have, it.grams);
    fromFreezer.push({ food: it.food, grams: used, was: it.grams });
    it.grams -= used;
    it.fromFreezer = used;
  }
  return { items, fromFreezer };
}

// ------------------------------------------------------------------- render

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const qty = g => (g >= 1000 ? `${Math.round(g / 100) / 10}kg` : `${Math.round(g)}g`);
const foodLabel = f => f.replace(/_/g, ' ');

function recipeCard(id, heading = null) {
  const r = R(id);
  if (!r) return '';
  const ings = (r.ingredients ?? []).filter(i => i.display);
  const from = (r.from ?? []).map(([src, n]) => {
    const s = R(src);
    return `<li class="from">${esc(n === s.serves ? 'the whole batch' : `${n} portion${n === 1 ? '' : 's'}`)} of <strong>${esc(s.name)}</strong></li>`;
  }).join('');
  const m = macroLine(id);
  return `<article class="card">
  <h4>${esc(heading ?? r.name)}${r.serves ? ` <span class="serves">Serves ${r.serves}</span>` : ''}</h4>
  ${r.notes ? `<p class="card-notes">${esc(r.notes)}</p>` : ''}
  ${ings.length || from ? `<ul class="ingredients">${from}${ings.map(i => `<li${i.basketOnly ? ' class="basket-only"' : ''}>${esc(i.display)}</li>`).join('')}</ul>` : ''}
  ${(r.method ?? []).length ? `<ol class="method">${r.method.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
  ${r.serving_suggestion ? `<p class="serving">${esc(r.serving_suggestion)}</p>` : ''}
  ${m ? `<p class="macro">${esc(m)}</p>` : ''}
</article>`;
}

const w = rotation.weeks[WEEK];
const displayOrder = rotation.display_order ?? DAYS;

const dayCards = displayOrder.map(day => {
  const id = w.dinners[day];
  const inner = id === 'scaffold:pizza'
    ? recipeCard(scaffold.friday_pizza.boys.recipe) + recipeCard(w.friday_pizza_topping) + recipeCard(w.friday_salad)
    : recipeCard(id);
  return `<div class="day-group"><h3 class="day-head">${esc(DAY_NAME[day])}</h3>${inner}</div>`;
}).join('');

const support = [w.batch_pot, w.extra_pot, w.lunchbox_protein, w.lunchbox_veg_tray,
                 w.lunchbox_dressing, w.lunchbox, w.flapjack].filter(Boolean).map(id => recipeCard(id)).join('');

const onTheDay = Object.values(scaffold.lunch_boxes.protein_schedule)
  .filter(d => d.recipe !== 'week').map(d => recipeCard(d.recipe)).join('');

const boxDays = Object.entries(scaffold.lunch_boxes.protein_schedule).map(([day, spec]) => {
  const d = lunchboxDay(day);
  const m = d.macros;
  const fin = FINISHER_OVERRIDES[day] ?? w.lunchbox_finishers[day];
  return `<li class="boxday">
    <span class="boxday-day">${esc(DAY_NAME[day])}</span>
    <span class="boxday-protein">${esc(spec.grams)}g ${esc(R(d.proteinId).name)} <em>${esc(d.when)}</em>${spec.source === 'smoked_mackerel' ? '<span class="omega">omega-3 day</span>' : ''}</span>
    ${fin ? `<span class="boxday-fin">Finisher: ${esc(fin)}${FINISHER_OVERRIDES[day] ? ' <b>(swapped)</b>' : ''}</span>` : ''}
    <span class="boxday-macro">~${roundKcal(m.kcal)} kcal · ${roundG(m.protein)}g protein · ${roundG(m.carbs)}g carbs · ${roundG(m.fat)}g fat · ${roundG(m.fibre)}g fibre</span>
  </li>`;
}).join('');

const { items, fromFreezer } = buildBasket();
const byAisle = new Map(AISLES.map(([k]) => [k, []]));
for (const it of items.values()) if (it.grams > 0) (byAisle.get(it.aisle) ?? byAisle.get('cupboard')).push(it);

const basket = AISLES.map(([key, label]) => {
  const rows = (byAisle.get(key) ?? []).sort((a, b) => b.grams - a.grams);
  if (!rows.length) return '';
  return `<div class="aisle"><h4>${label}</h4><ul>${rows.map(it => `
    <li class="basket-item"><label>
      <input type="checkbox" data-tick="b-${esc(it.food)}">
      <span class="qty">${esc(qty(it.grams))}</span><span class="food">${esc(foodLabel(it.food))}</span>
    </label>${it.fromFreezer ? `<p class="uses">${esc(qty(it.fromFreezer))} of this comes out of the freezer - buy the rest</p>` : ''}</li>`).join('')}</ul></div>`;
}).join('');

const freezerList = fromFreezer.sort((a, b) => b.grams - a.grams).map(f =>
  `<li class="basket-item"><label>
    <input type="checkbox" data-tick="f-${esc(f.food)}">
    <span class="qty">${esc(qty(f.grams))}</span><span class="food">${esc(foodLabel(f.food))}</span>
  </label>${f.grams < f.was ? `<p class="uses">of ${esc(qty(f.was))} needed - the rest is on the basket</p>` : ''}</li>`).join('');

const swapRows = SWAPS.map(([where, what]) =>
  `<li class="swap"><span class="swap-where">${esc(where)}</span><span class="swap-what">${esc(what)}</span></li>`).join('');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Week 2 - Using Up the Freezer</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
/* Generated by tools/week2-useup.mjs. One-off - delete both when the week is
   done. Tokens copied from build.mjs; --accent is the week 2 green. */
:root{
  --bg:#FAF7F2; --card:#FFFFFF; --border:#E8E0D4; --text:#2C2416; --text-light:#8A7E6B;
  --accent:#4A7C59; --accent-light:#E8F0EA;
  --shadow:0 1px 3px rgba(44,36,22,.08); --shadow-lg:0 4px 12px rgba(44,36,22,.1);
}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);line-height:1.6;-webkit-text-size-adjust:100%}
header{background:var(--text);color:var(--bg);padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;position:sticky;top:0;z-index:20}
header h1{font-family:'DM Serif Display',Georgia,serif;font-size:1.25rem;font-weight:400;line-height:1.2}
header .sub{font-size:.75rem;opacity:.6;display:block;font-family:'DM Sans',sans-serif}
.head-actions{display:flex;align-items:center;gap:.5rem;flex:0 0 auto}
.ghost{background:none;border:1px solid rgba(250,247,242,.3);color:var(--bg);border-radius:999px;padding:.4rem .9rem;font:inherit;font-size:.78rem;cursor:pointer;white-space:nowrap;min-height:36px;display:grid;place-items:center;text-decoration:none}
.ghost:hover{border-color:rgba(250,247,242,.65)}
nav.jump{display:flex;gap:.4rem;overflow-x:auto;background:var(--card);border-bottom:1px solid var(--border);padding:0 .75rem;position:sticky;top:60px;z-index:19}
nav.jump a{padding:.7rem .8rem;font-size:.85rem;font-weight:500;color:var(--text-light);text-decoration:none;white-space:nowrap;border-bottom:2px solid transparent}
nav.jump a:hover{color:var(--text);border-bottom-color:var(--accent)}
.container{max-width:820px;margin:0 auto;padding:1.25rem 1rem 4rem}
.block{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:1.1rem;margin-bottom:1rem;box-shadow:var(--shadow)}
h2{font-family:'DM Serif Display',Georgia,serif;font-size:1.25rem;font-weight:400;margin-bottom:.15rem}
h2 .n{color:var(--accent);font-family:'DM Sans',sans-serif;font-size:.72rem;font-weight:700;letter-spacing:.08em;display:block;text-transform:uppercase;margin-bottom:.1rem}
.lede{color:var(--text-light);margin-bottom:.9rem;font-size:.9rem}
.section-head{margin:1.6rem 0 .75rem;font-family:'DM Serif Display',Georgia,serif;font-size:1.2rem;font-weight:400}
.swaps{list-style:none;display:grid;gap:.45rem}
.swap{display:grid;gap:.15rem;padding:.6rem .75rem;border-left:3px solid var(--accent);background:var(--accent-light);border-radius:0 6px 6px 0}
.swap-where{font-size:.85rem;font-weight:700}
.swap-what{font-size:.85rem}
.day-group{margin-bottom:1rem}
.day-head{color:#fff;background:var(--accent);padding:.5rem .8rem;border-radius:8px;margin-bottom:.6rem;font-size:.85rem;text-transform:uppercase;letter-spacing:.06em}
.card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:1rem;margin-bottom:.6rem;box-shadow:var(--shadow)}
.card h4{font-family:'DM Serif Display',Georgia,serif;font-size:1.05rem;font-weight:400}
.card .serves{font-family:'DM Sans',sans-serif;font-size:.72rem;color:var(--text-light);font-weight:400}
.card-notes{font-size:.85rem;color:var(--text-light);margin:.3rem 0}
.ingredients{list-style:none;display:grid;gap:.2rem;margin:.6rem 0;font-size:.88rem}
.ingredients li:before{content:'';display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--accent);margin-right:.5rem;vertical-align:middle}
.ingredients li.basket-only{color:var(--text-light);font-style:italic}
.method{margin:.6rem 0 .6rem 1.1rem;display:grid;gap:.35rem;font-size:.88rem}
.serving{font-size:.85rem;color:var(--text-light);margin-top:.4rem}
.macro{font-size:.75rem;color:var(--text-light);margin-top:.5rem;padding-top:.5rem;border-top:1px solid var(--border)}
.boxdays{list-style:none;display:grid;gap:.5rem;margin:.75rem 0}
.boxday{display:grid;gap:.15rem;padding:.6rem .7rem;border:1px solid var(--border);border-radius:8px;background:var(--card)}
.boxday-day{font-weight:600;font-size:.85rem}
.boxday-protein{font-size:.85rem}
.boxday-protein em{color:var(--text-light);font-style:normal;font-size:.78rem}
.boxday-fin{font-size:.8rem;color:var(--text-light)}
.boxday-macro{font-size:.75rem;color:var(--text-light)}
.omega{display:inline-block;margin-left:.4rem;font-size:.68rem;padding:.1rem .4rem;border-radius:3px;background:var(--accent);color:#fff;vertical-align:middle}
.aisle{margin-bottom:1rem}
.aisle h4{font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-light);margin-bottom:.4rem}
.aisle ul{list-style:none;display:grid;gap:.4rem}
.basket-item{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:.65rem .8rem;box-shadow:var(--shadow)}
.basket-item label{display:flex;align-items:center;gap:.6rem;cursor:pointer;min-height:32px}
.basket-item input{width:22px;height:22px;flex:0 0 auto;accent-color:var(--accent)}
.qty{font-weight:600;font-size:.9rem;flex:0 0 auto}
.food{font-size:.9rem;text-transform:capitalize}
.uses{font-size:.75rem;color:var(--text-light);margin-top:.35rem;padding-left:2.2rem;line-height:1.45}
.basket-item.done .qty,.basket-item.done .food{text-decoration:line-through;opacity:.45}
.basket-item.done .uses{opacity:.4}
.plain{list-style:none;display:grid;gap:.5rem}
.plain li{display:grid;gap:.15rem;padding:.6rem .8rem;border:1px solid var(--border);border-radius:8px;background:var(--card)}
.plain .head{font-size:.9rem;font-weight:600}
.plain .sub2{font-size:.8rem;color:var(--text-light)}
.leave{display:flex;flex-wrap:wrap;gap:.4rem;list-style:none}
.leave li{background:var(--accent-light);border:1px solid var(--border);border-radius:999px;padding:.3rem .8rem;font-size:.85rem}
.callout{background:var(--accent-light);border-left:3px solid var(--accent);padding:.6rem .8rem;border-radius:0 6px 6px 0;margin:.6rem 0 0;font-size:.85rem}
footer{text-align:center;padding:2rem 1rem;font-size:.75rem;color:var(--text-light)}
@media(min-width:600px){.container{padding:1.5rem}header h1{font-size:1.45rem}}
</style>
</head>
<body>
<header>
  <h1>Week 2 - Using Up the Freezer<span class="sub">Cycle 1, double freezer bags. One-off - delete when the week is done.</span></h1>
  <div class="head-actions">
    <a class="ghost" href="index.html">Back</a>
    <button class="ghost" id="reset" type="button">Clear ticks</button>
  </div>
</header>
<nav class="jump">
  <a href="#changes">What is different</a>
  <a href="#week">The week</a>
  <a href="#lunches">Lunches</a>
  <a href="#basket">Basket</a>
  <a href="#later">Later</a>
</nav>

<div class="container">

  <section class="block" id="changes">
    <h2><span class="n">Start here</span>What is different</h2>
    <p class="lede">This is the whole of week 2, with the freezer swaps already made. Cook and shop from this page, not from the main site - everything below already accounts for what is in the freezer.</p>
    <ul class="swaps">${swapRows}</ul>
  </section>

  <h3 class="section-head" id="week">The week</h3>
  ${dayCards}

  <h3 class="section-head">Made on Saturday</h3>
  ${support}

  <h3 class="section-head">Into the boxes on the day</h3>
  ${onTheDay}

  <section class="block" id="lunches">
    <h2><span class="n">Lunches</span>${scaffold.lunch_boxes.total} boxes, ${scaffold.lunch_boxes.count_per_adult} each</h2>
    <p class="lede">Same base every day. The protein changes, and every box gets a spoonful of edamame this week.</p>
    <ul class="boxdays">${boxDays}</ul>
  </section>

  <section class="block" id="basket">
    <h2><span class="n">Basket</span>What to buy</h2>
    <p class="lede">Freezer stock already taken off. Anything listed here is what you still need.</p>
    ${basket}
  </section>

  <section class="block">
    <h2><span class="n">Basket</span>Out of the freezer, do not buy</h2>
    <p class="lede">Pull these out as you go. Where a line says the rest is on the basket, the freezer only covers part of it.</p>
    <ul class="aisle-list">${freezerList}</ul>
  </section>

  <section class="block" id="later">
    <h2><span class="n">Later</span>Earmarked, not this week</h2>
    <ul class="plain">
      <li>
        <span class="head">750g beef mince, for Week 4's ragu</span>
        <span class="sub2">Buy 250g that week instead of 1kg.</span>
      </li>
    </ul>
  </section>

  <section class="block">
    <h2><span class="n">Later</span>Leave alone</h2>
    <ul class="leave">
      <li>Chips</li><li>Nuggets</li><li>Margherita pizza</li><li>Hotdogs</li><li>Father-in-law's pudding</li>
    </ul>
    <p class="callout">Not part of the plan and not being counted. They stay where they are.</p>
  </section>

</div>

<footer>Generated by <code>tools/week2-useup.mjs</code> for week 2 only. Delete the script and <code>docs/week2-freezer.html</code> when the week is done.</footer>

<script>
(function(){
  var PREFIX = 'w2f:';
  var store = null;
  try { store = window.localStorage; } catch(err) { store = null; }
  function row(box){ return box.closest('.basket-item'); }
  document.addEventListener('change', function(e){
    var box = e.target.closest('[data-tick]');
    if(!box) return;
    row(box).classList.toggle('done', box.checked);
    try { if(store) store.setItem(PREFIX + box.dataset.tick, box.checked ? '1' : '0'); } catch(err){}
  });
  document.querySelectorAll('[data-tick]').forEach(function(box){
    var on = false;
    try { on = store && store.getItem(PREFIX + box.dataset.tick) === '1'; } catch(err){}
    box.checked = !!on;
    row(box).classList.toggle('done', !!on);
  });
  document.getElementById('reset').addEventListener('click', function(){
    document.querySelectorAll('[data-tick]').forEach(function(box){
      box.checked = false;
      row(box).classList.remove('done');
      try { if(store) store.removeItem(PREFIX + box.dataset.tick); } catch(err){}
    });
  });
})();
</script>
</body>
</html>
`;

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'week2-freezer.html');
writeFileSync(out, html);
console.log('wrote ' + out);
console.log('  ' + [...items.values()].filter(i => i.grams > 0).length + ' things to buy, '
  + fromFreezer.length + ' out of the freezer');
