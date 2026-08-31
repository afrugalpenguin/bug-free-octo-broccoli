// Reads the four data files and writes docs/index.html - the whole site, one
// self-contained page. Run `node tools/build.mjs`.
//
// The Saturday cook-through is the point of the exercise: every step carries
// its full ingredient list and method inline, so nobody has to tab away with
// their hands covered in flour. Everything else on the page supports it.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { recipes, rotation, scaffold, macroLine, macrosFor } from './calc.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'docs');
const outFile = join(outDir, 'index.html');

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const WEEKS = ['1', '2', '3', '4'];
const DAYS = rotation.day_order;
const DAY_NAME = rotation.day_names;

const AISLES = [
  ['meat',     'Meat'],
  ['fish',     'Fish'],
  ['dairy',    'Dairy'],
  ['bakery',   'Bakery'],
  ['fresh',    'Fruit &amp; Veg'],
  ['frozen',   'Frozen'],
  ['tinned',   'Tinned'],
  ['cupboard', 'Cupboard'],
];

// ---------------------------------------------------------------- components

function macroEl(id) {
  const line = macroLine(id);
  if (!line) return `<div class="macro empty" data-macro="${esc(id)}">Ingredients not entered yet - no macros until they are.</div>`;
  return `<div class="macro" data-macro="${esc(id)}">${esc(line)} <em>per portion</em></div>`;
}

function ingredientList(id) {
  const r = recipes[id];
  const ings = (r.ingredients ?? []).filter(i => i.display);
  const from = r.from ?? [];
  if (!ings.length && !from.length) return '';

  const fromLines = from.map(([src, n]) => {
    const s = recipes[src];
    const share = n === s.serves ? 'the whole batch' : `${n} portion${n === 1 ? '' : 's'}`;
    return `<li class="from">${esc(share)} of <strong>${esc(s.name)}</strong></li>`;
  }).join('');

  const lines = ings.map(i => {
    const cls = i.basketOnly ? ' class="basket-only"' : i.macroOnly ? ' class="macro-only"' : '';
    return `<li${cls}>${esc(i.display)}</li>`;
  }).join('');

  return `<ul class="ingredients">${fromLines}${lines}</ul>`;
}

function methodList(id) {
  const m = recipes[id].method ?? [];
  if (!m.length) return '';
  return `<ol class="method">${m.map(s => `<li>${esc(s)}</li>`).join('')}</ol>`;
}

function sourceTag(id) {
  const s = recipes[id].source;
  if (!s || typeof s !== 'object') return '';
  return `<span class="source">${esc(s.book)}${s.page ? `, p.${s.page}` : ''}</span>`;
}

function timeTag(id) {
  const t = recipes[id].tags ?? {};
  const bits = [];
  if (t.activeMinutes) bits.push(`${t.activeMinutes} min hands-on`);
  if (t.passiveMinutes) bits.push(`${t.passiveMinutes} min waiting`);
  return bits.length ? `<span class="time">${esc(bits.join(' / '))}</span>` : '';
}

function recipeCard(id, { anchor = null, heading = null, level = 'h3' } = {}) {
  const r = recipes[id];
  if (!r) return `<div class="card"><p class="warn">Missing recipe: ${esc(id)}</p></div>`;
  if (r.alias) return recipeCard(r.alias, { anchor, heading, level });

  const serves = r.serves ? `<span class="serves">Serves ${r.serves}</span>` : '';
  const idAttr = anchor ? ` id="${esc(anchor)}"` : '';

  return `<article class="card"${idAttr}>
  <${level} class="card-title">${esc(heading ?? r.name)}</${level}>
  <div class="meta">${serves}${timeTag(id)}${sourceTag(id)}</div>
  ${r.classification ? `<p class="classification">${esc(r.classification)}</p>` : ''}
  ${r.notes ? `<p class="notes">${esc(r.notes)}</p>` : ''}
  ${ingredientList(id)}
  ${methodList(id)}
  ${r.serving_suggestion ? `<p class="serving">${esc(r.serving_suggestion)}</p>` : ''}
  ${r.adults ? `<p class="adults"><strong>Adults:</strong> ${esc(r.adults)}</p>` : ''}
  ${macroEl(id)}
</article>`;
}

// ------------------------------------------------------------------- baskets

// Everything a week needs bought, as a list of {recipe, multiplier}. `from`
// links are deliberately NOT followed: a `from` always means portions of a
// batch that is already on this list at full size, so following one would buy
// the same pot twice.
function weekBasketPlan(week, cycle) {
  const w = rotation.weeks[week];
  const bags = cycle === 1 ? scaffold.freezer_bank.cycle_1.weekly_bags
                           : scaffold.freezer_bank.cycle_2_onwards.weekly_bags;
  const plan = [];
  const add = (id, n = 1) => { if (id && recipes[id]) plan.push({ id, n }); };

  add(w.flapjack);
  add(w.lunchbox_dressing);
  add(w.lunchbox_protein);
  add(w.lunchbox_veg_tray);
  add(w.lunchbox, scaffold.lunch_boxes.total);
  add(w.batch_pot);
  add(w.extra_pot);
  add(w.traybake);
  add(w.roast);
  for (const day of ['mon', 'tue', 'wed']) add(w.dinners[day]);
  add(w.freezer_bag, bags);
  add(scaffold.friday_pizza.boys.recipe);
  add(w.friday_pizza_topping);
  add(w.friday_salad);
  add('sandwiches_adults', 2);
  add('sandwiches_boys', 2);
  add('tuna_pasta_salad');
  add('boiled_eggs');
  add('quick_pickled_red_onions');
  add('smoothie_bag', scaffold.smoothie_bags.count);
  return plan;
}

// Roll the plan up into one line per food, carrying the reasons with it. The
// reasons are the point: "7 peppers" is useless, "7 peppers, 2 for the
// traybake and 1 in the chilli" is a shopping list you can act on.
function buildBasket(week, cycle) {
  const items = new Map();
  for (const { id, n } of weekBasketPlan(week, cycle)) {
    const r = recipes[id];
    for (const ing of r.ingredients ?? []) {
      if (ing.macroOnly) continue;           // bought under another recipe
      const cur = items.get(ing.food) ?? { food: ing.food, aisle: ing.aisle, grams: 0, uses: [] };
      cur.grams += ing.grams * n;
      cur.uses.push({
        recipe: r.name,
        display: ing.display,
        n,
        note: r.basket_notes?.[ing.food] ?? null,
      });
      items.set(ing.food, cur);
    }
  }
  return items;
}

function quantity(grams) {
  if (grams >= 1000) return `${Math.round(grams / 100) / 10}kg`;
  return `${Math.round(grams)}g`;
}

function basketPanel(week, cycle) {
  const items = buildBasket(week, cycle);
  const byAisle = new Map(AISLES.map(([k]) => [k, []]));
  for (const it of items.values()) (byAisle.get(it.aisle) ?? byAisle.get('cupboard')).push(it);

  return AISLES.map(([key, label]) => {
    const rows = (byAisle.get(key) ?? []).sort((a, b) => b.grams - a.grams);
    if (!rows.length) return '';
    const lis = rows.map(it => {
      const uses = it.uses.map(u => {
        const each = u.n > 1 ? ` x${u.n}` : '';
        const note = u.note ? ` - ${u.note}` : '';
        return esc(`${u.display}${each} (${u.recipe})${note}`);
      }).join('<br>');
      const tickKey = `${week}-${cycle}-${it.food}`;
      return `<li class="basket-item"><label><input type="checkbox" data-basket="${esc(tickKey)}">
        <span class="qty">${esc(quantity(it.grams))}</span>
        <span class="food">${esc(it.food.replace(/_/g, ' '))}</span></label>
        <div class="uses">${uses}</div></li>`;
    }).join('');
    return `<section class="aisle"><h4>${label}</h4><ul>${lis}</ul></section>`;
  }).join('');
}

// ------------------------------------------------------ Saturday cook-through

function cookStep(n, title, detail, body) {
  return `<section class="step">
  <h3><span class="step-n">${n}</span>${esc(title)}</h3>
  ${detail ? `<p class="step-detail">${esc(detail)}</p>` : ''}
  ${body}
</section>`;
}

function inlineRecipe(id, heading = null, extraNote = null) {
  const r = recipes[id];
  if (!r) return '';
  return `<div class="inline-recipe">
  <h4>${esc(heading ?? r.name)}${r.serves ? ` <span class="serves">Serves ${r.serves}</span>` : ''}</h4>
  ${extraNote ? `<p class="callout">${esc(extraNote)}</p>` : ''}
  ${r.notes ? `<p class="notes">${esc(r.notes)}</p>` : ''}
  ${ingredientList(id)}
  ${methodList(id)}
  ${r.adults ? `<p class="adults"><strong>Adults:</strong> ${esc(r.adults)}</p>` : ''}
  ${macroEl(id)}
</div>`;
}

function saturdayPanel(week, cycle) {
  const w = rotation.weeks[week];
  const order = scaffold.cook_order;
  const bags = cycle === 1 ? scaffold.freezer_bank.cycle_1.weekly_bags
                           : scaffold.freezer_bank.cycle_2_onwards.weekly_bags;
  const steps = [];
  let n = 0;
  const step = (title, detail, body) => steps.push(cookStep(++n, title, detail, body));
  const extraFor = id => (w.saturday_extras ?? []).find(e => e.recipe === id)?.note ?? null;

  step(order[0].step, order[0].detail, inlineRecipe(w.flapjack));
  step(order[1].step, order[1].detail, inlineRecipe(w.lunchbox_veg_tray));
  step(order[2].step, order[2].detail, inlineRecipe(w.lunchbox_protein, null, extraFor(w.lunchbox_protein)));
  step(order[3].step, `${order[3].detail} This is what you are all eating tonight.`, inlineRecipe(w.traybake));

  const pots = [w.batch_pot, w.extra_pot].filter(Boolean);
  step(order[4].step, order[4].detail, pots.map(p => inlineRecipe(p)).join(''));

  step(order[5].step, `${order[5].detail} ${scaffold.boiled_eggs.usage}.`, inlineRecipe('boiled_eggs'));

  const coldExtras = (w.saturday_extras ?? []).filter(e => e.recipe !== w.lunchbox_protein);
  const bagHeading = `${recipes[w.freezer_bag].name}${bags > 1 ? `, make ${bags}` : ''}`;
  const bagNote = bags > 1
    ? 'Cycle 1: make two of these. One is Thursday, one goes straight into the bank.'
    : 'Cycle 2 onwards: one bag. That is Thursday.';
  const cold = [
    inlineRecipe(w.freezer_bag, bagHeading, bagNote),
    inlineRecipe('smoothie_bag', `Smoothie bags, make ${scaffold.smoothie_bags.count}`,
      `${scaffold.smoothie_bags.notes} ${scaffold.smoothie_bags.banana_note}`),
    inlineRecipe(w.lunchbox_dressing),
    inlineRecipe('quick_pickled_red_onions', null, scaffold.pickled_onions.frequency),
    inlineRecipe('tuna_pasta_salad'),
    ...coldExtras.map(e => inlineRecipe(e.recipe, `${recipes[e.recipe].name}, Saturday's part`, e.note)),
  ].join('');
  step(order[6].step, order[6].detail, cold);

  const finishers = DAYS.filter(d => w.lunchbox_finishers[d])
    .map(d => `<li><strong>${esc(DAY_NAME[d])}</strong> ${esc(w.lunchbox_finishers[d])}</li>`).join('');
  step(order[7].step, `${order[7].detail} ${scaffold.lunch_boxes.build_notes}`,
    `${inlineRecipe(w.lunchbox, `${recipes[w.lunchbox].name}, build ${scaffold.lunch_boxes.total}`)}
     <div class="finishers"><h4>Finishers, added on the day</h4><ul>${finishers}</ul></div>`);

  // Where everything goes, read straight off the splits in the data.
  const dests = [];
  for (const { id } of weekBasketPlan(week, cycle)) {
    const r = recipes[id];
    if (!r.splits) continue;
    const label = r.name.toUpperCase().split(',')[0];
    const parts = Object.entries(r.splits).map(([k, v]) => {
      const dest = k === 'freezer' ? `bag for the freezer, labelled ${label} + the month`
        : k === 'fridge' ? 'tub for the fridge'
        : k === 'lunchbox' ? 'set aside for the lunch boxes'
        : `tub for ${DAY_NAME[k] ?? k}`;
      return `<li>${v} portions to a ${esc(dest)}</li>`;
    }).join('');
    dests.push(`<div class="split"><h4>${esc(r.name)}</h4><ul>${parts}</ul></div>`);
  }
  step(order[8].step, order[8].detail, dests.join('') || '<p class="notes">Nothing to divide this week.</p>');

  const notMade = scaffold.not_made_saturday.map(x => `<li>${esc(x)}</li>`).join('');

  return `<div class="cook-through">
  <p class="lede">Top to bottom, in order. Everything you need is on this page, so you should never have to leave it.</p>
  ${steps.join('')}
  <section class="step not-made"><h3>Not made tonight</h3>
    <p class="step-detail">Still to do during the week.</p>
    <ul>${notMade}</ul></section>
</div>`;
}

// ---------------------------------------------------------------- week panels

function menuPanel(week) {
  const w = rotation.weeks[week];
  const rows = DAYS.map(day => {
    const id = w.dinners[day];
    const isPizza = id === 'scaffold:pizza';
    const name = isPizza
      ? `Pizza night: ${esc(recipes[w.friday_pizza_topping].name.replace(", the Adults'", ''))} and margherita`
      : esc(recipes[id]?.name ?? id);
    const swap = Object.entries(w.seasonal_swaps ?? {})
      .filter(([, m]) => m[day])
      .map(([season, m]) => `<div class="swap">${esc(season)}: ${esc(recipes[m[day]]?.name ?? m[day])}</div>`).join('');
    const macro = isPizza || !macroLine(id) ? '' : `<div class="menu-macro">${esc(macroLine(id))}</div>`;
    return `<li class="menu-row">
      <a href="#w${esc(week)}-${esc(day)}">
        <span class="menu-day">${esc(DAY_NAME[day])}</span>
        <span class="menu-name">${name}</span>
      </a>${macro}${swap}</li>`;
  }).join('');

  return `<div class="menu">
  <p class="theme">${esc(w.theme)}</p>
  <ul class="menu-list">${rows}</ul>
  <section class="block"><h3>Lunches</h3>
    <p>${scaffold.lunch_boxes.total} boxes, ${scaffold.lunch_boxes.count_per_adult} each.
       ${esc(recipes[w.lunchbox_protein].name)} with ${esc(recipes[w.lunchbox_dressing].name.toLowerCase())}.</p>
    ${macroEl(w.lunchbox)}
    <p class="notes">Saturday is sandwiches. Sunday is the tuna pasta salad made the night before.</p></section>
</div>`;
}

function recipesPanel(week) {
  const w = rotation.weeks[week];
  const cards = DAYS.map(day => {
    const id = w.dinners[day];
    const inner = id === 'scaffold:pizza'
      ? recipeCard(scaffold.friday_pizza.boys.recipe, { level: 'h4' })
        + recipeCard(w.friday_pizza_topping, { level: 'h4' })
        + recipeCard(w.friday_salad, { level: 'h4' })
      : recipeCard(id, { level: 'h4' });
    return `<div id="w${week}-${day}" class="day-group">
      <h3 class="day-head">${esc(DAY_NAME[day])}</h3>${inner}</div>`;
  }).join('');

  const support = [w.batch_pot, w.extra_pot, w.lunchbox_protein, w.lunchbox_veg_tray,
                   w.lunchbox_dressing, w.lunchbox, w.flapjack]
    .filter(Boolean)
    .map(id => recipeCard(id, { level: 'h4' })).join('');

  return `<div class="recipes">${cards}
  <div class="day-group"><h3 class="day-head">Made on Saturday</h3>${support}</div></div>`;
}

function weekPanel(week) {
  const w = rotation.weeks[week];
  const subtabs = [
    ['menu', 'Menu', menuPanel(week)],
    ['basket', 'Basket', `<div class="cycle-switch">
        <button class="cyc active" data-cycle="1" data-group="b${week}">Cycle 1 <span>double bags</span></button>
        <button class="cyc" data-cycle="2" data-group="b${week}">Cycle 2+ <span>single bags</span></button>
      </div>
      <p class="notes">${esc(scaffold.freezer_bank.cycle_1.description)}</p>
      <div class="cycle-body" data-group="b${week}" data-cycle="1">${basketPanel(week, 1)}</div>
      <div class="cycle-body" data-group="b${week}" data-cycle="2" hidden>${basketPanel(week, 2)}</div>`],
    ['saturday', 'Saturday', `<div class="cycle-switch">
        <button class="cyc active" data-cycle="1" data-group="s${week}">Cycle 1</button>
        <button class="cyc" data-cycle="2" data-group="s${week}">Cycle 2+</button>
      </div>
      <div class="cycle-body" data-group="s${week}" data-cycle="1">${saturdayPanel(week, 1)}</div>
      <div class="cycle-body" data-group="s${week}" data-cycle="2" hidden>${saturdayPanel(week, 2)}</div>`],
    ['recipes', 'Recipes', recipesPanel(week)],
  ];

  const bar = subtabs.map(([k, label], i) =>
    `<button class="subtab${i === 0 ? ' active' : ''}" data-sub="${week}-${k}">${label}</button>`).join('');
  const panels = subtabs.map(([k, , body], i) =>
    `<div class="subpanel${i === 0 ? ' active' : ''}" data-sub="${week}-${k}">${body}</div>`).join('');

  return `<div class="panel" data-tab="week-${week}" data-week="${week}">
  <div class="week-head week${week}"><h2>Week ${week}</h2><span>${esc(w.theme)}</span></div>
  <div class="subtabs">${bar}</div>
  ${panels}
</div>`;
}

// --------------------------------------------------------- overview + Fridays

function overviewPanel() {
  const rhythm = scaffold.rhythm.map(r =>
    `<li><span class="when">${esc(r.when)}</span><span class="what">${esc(r.what)}</span></li>`).join('');

  const weeks = WEEKS.map(w => {
    const r = rotation.weeks[w];
    return `<li class="wk week${w}"><button data-goto="week-${w}"><strong>Week ${w}</strong>
      <span>${esc(r.theme)}</span>
      <em>${esc(recipes[r.traybake].name)} / ${esc(recipes[r.roast].name)} / ${esc(recipes[r.batch_pot].name)}</em>
      </button></li>`;
  }).join('');

  return `<div class="panel active" data-tab="overview">
  <section class="block"><h2>The week</h2>
    <p class="lede">Friday to Thursday, anchored to delivery day. One prep session on Saturday night produces almost everything.</p>
    <ul class="rhythm">${rhythm}</ul></section>

  <section class="block"><h2>The rotation</h2><ul class="weeks">${weeks}</ul></section>

  <section class="block"><h2>The freezer bank</h2>
    <p>${esc(scaffold.freezer_bank.cycle_1.description)}</p>
    <p>${esc(scaffold.freezer_bank.cycle_2_onwards.description)}</p>
    <p class="callout">${esc(scaffold.freezer_bank.freezer_week)}</p></section>

  <section class="block"><h2>Dressings</h2>
    <p>${esc(scaffold.dressings.notes)}</p></section>
</div>`;
}

// Which rotation slot, if any, a bank recipe is wired into. Read off the
// seasonal swaps so the bank page and the week pages cannot drift apart.
function bankSlots(id) {
  const out = [];
  for (const w of WEEKS) {
    const week = rotation.weeks[w];
    for (const [season, map] of Object.entries(week.seasonal_swaps ?? {})) {
      for (const [day, swapId] of Object.entries(map)) {
        if (swapId === id) out.push(`Week ${w} ${DAY_NAME[day]}, in ${season}`);
      }
    }
    if (Object.values(week.dinners).includes(id) || recipes[id]?.alias
        && Object.values(week.dinners).includes(recipes[id].alias)) {
      out.push(`Week ${w}, in rotation now`);
    }
  }
  return out;
}

function bankPanel() {
  const entries = Object.entries(recipes).filter(([, r]) => r.category === 'bank');
  const buckets = [...new Set(entries.map(([, r]) => r.bucket))];

  const sections = buckets.map(bucket => {
    const rows = entries.filter(([, r]) => r.bucket === bucket).map(([id, r]) => {
      const slots = bankSlots(id);
      return `<li class="${r.incomplete ? 'incomplete' : 'ready'}">
        <strong>${esc(r.name)}</strong>
        <span class="source">${esc(r.source.book)}${r.source.page ? `, p.${r.source.page}` : ''}</span>
        <em>${esc(r.classification)}</em>
        ${slots.length ? `<span class="slot">${esc(slots.join(' / '))}</span>` : ''}
        ${r.incomplete ? '<span class="flag">Ingredients not entered yet</span>' : ''}</li>`;
    }).join('');
    return `<section class="block"><h3>${esc(bucket)}</h3><ul class="bank">${rows}</ul></section>`;
  }).join('');

  const waiting = entries.filter(([, r]) => r.incomplete).length;

  return `<div class="panel" data-tab="bank">
  <section class="block"><h2>The bank</h2>
    <p class="lede">Recipes graded and parked. Nothing here is in the weekly rhythm unless it says so, but they are the first place to look for a summer swap, a together night, or a day the schedule goes sideways.</p>
    ${waiting ? `<p class="callout">${waiting} of these have no ingredient list yet, so no macros. Add them to <code>data/recipes.json</code> with gram weights and <code>food</code> keys, drop the <code>incomplete</code> flag, and rebuild.</p>` : ''}
  </section>
  ${sections}
</div>`;
}

function fridaysPanel() {
  const weeks = WEEKS.map(w => {
    const r = rotation.weeks[w];
    return `<div class="day-group"><h3 class="day-head week${w}">Week ${w}: ${esc(r.theme)}</h3>
      ${recipeCard(r.friday_pizza_topping, { level: 'h4' })}
      ${recipeCard(r.friday_salad, { level: 'h4' })}</div>`;
  }).join('');

  return `<div class="panel" data-tab="fridays">
  <section class="block"><h2>Friday is pizza night</h2>
    <p class="lede">Every week, no exceptions. Dough out of the freezer into the fridge on Thursday night.</p>
    <p>${esc(scaffold.friday_pizza.adults.notes)}</p></section>
  ${recipeCard(scaffold.friday_pizza.boys.recipe, { level: 'h3' })}
  <h2 class="section-head">The adults' topping, by week</h2>
  ${weeks}
</div>`;
}

// ------------------------------------------------------------------ assembly

const CSS = `
:root{
  --bg:#FAF7F2; --card:#FFFFFF; --border:#E8E0D4; --text:#2C2416; --text-light:#8A7E6B;
  --accent:#C45D3E; --accent-light:#F4E8E3;
  --week1:#C45D3E; --week2:#4A7C59; --week3:#3D6B8E; --week4:#7B5EA7;
  --shadow:0 1px 3px rgba(44,36,22,.08);
}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);line-height:1.6;-webkit-text-size-adjust:100%}
header{background:var(--text);color:var(--bg);padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;position:sticky;top:0;z-index:20}
header h1{font-family:'DM Serif Display',Georgia,serif;font-size:1.25rem;font-weight:400;line-height:1.2}
header .sub{font-size:.75rem;opacity:.6;display:block;font-family:'DM Sans',sans-serif}
#today{background:var(--accent);color:#fff;border:0;border-radius:999px;padding:.45rem 1.1rem;font:inherit;cursor:pointer;white-space:nowrap;min-height:44px;display:grid;gap:0;line-height:1.25;text-align:center}
#today .t-label{font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;opacity:.75}
#today .t-slot{font-size:.85rem;font-weight:600}
#today:active{transform:scale(.97)}
.tabs{display:flex;background:var(--card);border-bottom:1px solid var(--border);overflow-x:auto;position:sticky;top:76px;z-index:19;-webkit-overflow-scrolling:touch}
.tab{padding:.85rem 1.1rem;border:0;border-bottom:2px solid transparent;background:none;font:inherit;font-size:.9rem;font-weight:500;color:var(--text-light);white-space:nowrap;cursor:pointer;min-height:44px}
.tab.active{color:var(--accent);border-bottom-color:var(--accent)}
.tab[data-tab="bank"]{margin-left:auto;color:var(--text-light);opacity:.85}
.tab[data-tab="bank"].active{opacity:1}
.tab[data-tab="week-1"].active{color:var(--week1);border-bottom-color:var(--week1)}
.tab[data-tab="week-2"].active{color:var(--week2);border-bottom-color:var(--week2)}
.tab[data-tab="week-3"].active{color:var(--week3);border-bottom-color:var(--week3)}
.tab[data-tab="week-4"].active{color:var(--week4);border-bottom-color:var(--week4)}
.container{max-width:820px;margin:0 auto;padding:1.25rem 1rem 4rem}
.panel{display:none}.panel.active{display:block}
.subpanel{display:none}.subpanel.active{display:block}
.subtabs{display:flex;gap:.4rem;overflow-x:auto;margin:0 0 1.25rem;padding-bottom:.25rem}
.subtab{flex:0 0 auto;padding:.55rem 1rem;border:1px solid var(--border);border-radius:999px;background:var(--card);font:inherit;font-size:.85rem;color:var(--text-light);cursor:pointer;min-height:40px}
.subtab.active{background:var(--text);color:var(--bg);border-color:var(--text)}
h2{font-family:'DM Serif Display',Georgia,serif;font-weight:400;font-size:1.35rem;margin-bottom:.5rem}
h3{font-size:1.05rem;margin-bottom:.35rem}
h4{font-size:.98rem;margin-bottom:.35rem}
.week-head{display:flex;align-items:baseline;gap:.6rem;padding:.9rem 1rem;border-radius:10px;color:#fff;margin-bottom:1rem}
.week-head h2{color:#fff;font-size:1.2rem}
.week-head span{font-size:.85rem;opacity:.85}
.week1{background:var(--week1)}.week2{background:var(--week2)}.week3{background:var(--week3)}.week4{background:var(--week4)}
h3.day-head.week1,h3.day-head.week2,h3.day-head.week3,h3.day-head.week4{color:#fff;padding:.5rem .8rem;border-radius:8px}
.block{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:1.1rem;margin-bottom:1rem;box-shadow:var(--shadow)}
.lede{color:var(--text-light);margin-bottom:.75rem}
.notes{color:var(--text-light);font-size:.9rem;margin:.4rem 0}
.callout{background:var(--accent-light);border-left:3px solid var(--accent);padding:.6rem .8rem;border-radius:0 6px 6px 0;margin:.6rem 0;font-size:.9rem}
.rhythm{list-style:none}
.rhythm li{display:flex;gap:.75rem;padding:.5rem 0;border-bottom:1px solid var(--border)}
.rhythm li:last-child{border:0}
.when{flex:0 0 5.5rem;font-weight:600;font-size:.85rem}
.what{font-size:.9rem;color:var(--text-light)}
.weeks{list-style:none;display:grid;gap:.6rem}
.wk button{width:100%;text-align:left;border:0;border-radius:10px;padding:.9rem 1rem;color:#fff;font:inherit;cursor:pointer;display:grid;gap:.15rem;min-height:44px}
.wk.week1 button{background:var(--week1)}.wk.week2 button{background:var(--week2)}
.wk.week3 button{background:var(--week3)}.wk.week4 button{background:var(--week4)}
.wk span{font-size:.85rem;opacity:.9}.wk em{font-size:.78rem;opacity:.75;font-style:normal}
.menu-list{list-style:none;display:grid;gap:.5rem;margin-bottom:1rem}
.menu-row{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:.75rem .9rem;box-shadow:var(--shadow)}
.menu-row a{display:flex;gap:.75rem;align-items:baseline;text-decoration:none;color:inherit;min-height:32px}
.menu-day{flex:0 0 4.5rem;font-weight:600;font-size:.85rem;color:var(--text-light)}
.menu-name{font-weight:500}
.menu-macro{font-size:.75rem;color:var(--text-light);margin-top:.3rem;padding-left:5.25rem}
.swap{font-size:.75rem;color:var(--accent);margin-top:.25rem;padding-left:5.25rem;font-style:italic}
.theme{font-size:.9rem;color:var(--text-light);margin-bottom:.75rem}
.card,.inline-recipe{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:.9rem;box-shadow:var(--shadow)}
.card-title{font-size:1.05rem}
.meta{display:flex;flex-wrap:wrap;gap:.5rem;font-size:.75rem;color:var(--text-light);margin-bottom:.5rem}
.serves{font-size:.75rem;color:var(--text-light);font-weight:600}
.source{font-style:italic}
.classification{font-size:.85rem;color:var(--accent);margin-bottom:.4rem}
.ingredients{list-style:none;margin:.6rem 0;display:grid;gap:.2rem}
.ingredients li{font-size:.9rem;padding-left:1rem;position:relative}
.ingredients li:before{content:"";position:absolute;left:0;top:.65em;width:5px;height:5px;border-radius:50%;background:var(--border)}
.ingredients li.from{color:var(--text-light);font-style:italic}
.ingredients li.basket-only,.ingredients li.macro-only{color:var(--text-light);font-style:italic}
.method{margin:.6rem 0 .6rem 1.1rem;display:grid;gap:.35rem}
.method li{font-size:.9rem;padding-left:.2rem}
.serving{font-size:.88rem;margin:.5rem 0}
.adults{font-size:.88rem;color:var(--week4);font-style:italic;margin:.5rem 0}
.macro{font-size:.78rem;color:var(--text-light);border-top:1px solid var(--border);padding-top:.5rem;margin-top:.6rem}
.macro em{opacity:.7}
.macro.empty{font-style:italic}
.day-group{margin-bottom:1.5rem;scroll-margin-top:130px}
.day-head{margin-bottom:.6rem;color:var(--text-light);text-transform:uppercase;letter-spacing:.06em;font-size:.78rem}
.section-head{margin:1.5rem 0 .75rem}
.cycle-switch{display:flex;gap:.4rem;margin-bottom:.9rem}
.cyc{flex:1;padding:.6rem;border:1px solid var(--border);border-radius:8px;background:var(--card);font:inherit;font-size:.85rem;cursor:pointer;min-height:44px;display:grid}
.cyc span{font-size:.7rem;color:var(--text-light)}
.cyc.active{background:var(--text);color:var(--bg);border-color:var(--text)}
.cyc.active span{color:var(--bg);opacity:.7}
.aisle{margin-bottom:1.25rem}
.aisle h4{text-transform:uppercase;letter-spacing:.06em;font-size:.75rem;color:var(--text-light);margin-bottom:.5rem}
.aisle ul{list-style:none;display:grid;gap:.4rem}
.basket-item{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:.65rem .8rem;box-shadow:var(--shadow)}
.basket-item label{display:flex;align-items:center;gap:.6rem;cursor:pointer;min-height:32px}
.basket-item input{width:22px;height:22px;flex:0 0 auto;accent-color:var(--accent)}
.qty{font-weight:600;font-size:.9rem;flex:0 0 auto}
.food{font-size:.9rem;text-transform:capitalize}
.uses{font-size:.75rem;color:var(--text-light);margin-top:.35rem;padding-left:2.2rem;line-height:1.45}
.basket-item.done .qty,.basket-item.done .food{text-decoration:line-through;opacity:.45}
.basket-item.done .uses{opacity:.4}
.cook-through .step{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:1rem;box-shadow:var(--shadow)}
.step h3{display:flex;align-items:center;gap:.6rem;font-size:1.1rem}
.step-n{flex:0 0 1.9rem;height:1.9rem;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;font-size:.85rem;font-weight:700}
.step-detail{color:var(--text-light);font-size:.9rem;margin:.4rem 0 .75rem}
.inline-recipe{background:var(--bg);box-shadow:none}
.inline-recipe h4{display:flex;justify-content:space-between;align-items:baseline;gap:.5rem}
.finishers,.split{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:.8rem;margin-top:.6rem}
.finishers ul,.split ul{list-style:none;display:grid;gap:.3rem;font-size:.88rem}
.not-made ul{list-style:none;display:grid;gap:.35rem;font-size:.9rem}
.not-made li{padding-left:1rem;position:relative}
.not-made li:before{content:"x";position:absolute;left:0;color:var(--accent);font-weight:700}
.bank{list-style:none;display:grid;gap:.5rem}
.bank li{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:.7rem .85rem;display:grid;gap:.15rem;font-size:.9rem}
.bank .source{font-size:.78rem;color:var(--text-light)}
.bank em{font-size:.8rem;color:var(--text-light);font-style:normal}
.bank .flag{font-size:.72rem;color:var(--accent);font-weight:600}
.bank .slot{font-size:.75rem;color:var(--week2);font-weight:600}
.bank li.ready{border-left:3px solid var(--week2)}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.85em;background:var(--bg);padding:.1em .35em;border-radius:4px}
.warn{color:var(--accent);font-weight:600}
footer{text-align:center;padding:2rem 1rem;font-size:.75rem;color:var(--text-light)}
.flash{box-shadow:0 0 0 3px var(--accent)}
@media(min-width:600px){.container{padding:1.5rem}header h1{font-size:1.45rem}}
`;

const JS = `
(function(){
  var anchor = ${JSON.stringify(scaffold.today_button.anchor_friday)};
  var cycleLen = ${scaffold.today_button.cycle_length_days};
  var days = ${JSON.stringify(DAYS)};
  var dayNames = ${JSON.stringify(DAY_NAME)};

  function show(tab){
    document.querySelectorAll('.tab').forEach(function(t){ t.classList.toggle('active', t.dataset.tab===tab); });
    document.querySelectorAll('.panel').forEach(function(p){ p.classList.toggle('active', p.dataset.tab===tab); });
  }
  function showSub(key){
    var week = key.split('-')[0];
    var panel = document.querySelector('.panel[data-week="'+week+'"]');
    if(!panel) return;
    panel.querySelectorAll('.subtab').forEach(function(t){ t.classList.toggle('active', t.dataset.sub===key); });
    panel.querySelectorAll('.subpanel').forEach(function(p){ p.classList.toggle('active', p.dataset.sub===key); });
  }

  document.addEventListener('click', function(e){
    var tab = e.target.closest('.tab');
    if(tab){ show(tab.dataset.tab); window.scrollTo(0,0); return; }
    var sub = e.target.closest('.subtab');
    if(sub){ showSub(sub.dataset.sub); return; }
    var goto = e.target.closest('[data-goto]');
    if(goto){ show(goto.dataset.goto); window.scrollTo(0,0); return; }
    var cyc = e.target.closest('.cyc');
    if(cyc){
      var g = cyc.dataset.group, c = cyc.dataset.cycle;
      document.querySelectorAll('.cyc[data-group="'+g+'"]').forEach(function(b){ b.classList.toggle('active', b===cyc); });
      document.querySelectorAll('.cycle-body[data-group="'+g+'"]').forEach(function(d){ d.hidden = d.dataset.cycle!==c; });
      return;
    }
    // A menu row jumps to that day's card in the Recipes sub-tab.
    var link = e.target.closest('.menu-row a');
    if(link){
      e.preventDefault();
      var id = link.getAttribute('href').slice(1);
      var wk = id.slice(1).split('-')[0];
      showSub(wk+'-recipes');
      var target = document.getElementById(id);
      if(target) target.scrollIntoView({behavior:'smooth', block:'start'});
    }
  });

  // Basket ticks survive a reload, because a shop takes more than one sitting.
  var store = null;
  try { store = window.localStorage; } catch(err) { store = null; }
  document.addEventListener('change', function(e){
    var box = e.target.closest('[data-basket]');
    if(!box) return;
    box.closest('.basket-item').classList.toggle('done', box.checked);
    try { if(store) store.setItem('basket:'+box.dataset.basket, box.checked?'1':'0'); } catch(err){}
  });
  document.querySelectorAll('[data-basket]').forEach(function(box){
    var on = false;
    try { on = store && store.getItem('basket:'+box.dataset.basket)==='1'; } catch(err){}
    box.checked = !!on;
    box.closest('.basket-item').classList.toggle('done', !!on);
  });

  // Which week and which day is it? Counted forward from the anchor Friday.
  function todaySlot(){
    var a = new Date(anchor + 'T00:00:00');
    var now = new Date(); now.setHours(0,0,0,0);
    var diff = Math.floor((now - a) / 86400000);
    var into = ((diff % cycleLen) + cycleLen) % cycleLen;
    return { week: String(Math.floor(into/7)+1), day: days[into%7] };
  }

  var btn = document.getElementById('today');
  var slot = todaySlot();
  btn.innerHTML = '<span class="t-label">Today</span><span class="t-slot">'
    + dayNames[slot.day].slice(0,3) + ', wk ' + slot.week + '</span>';
  btn.setAttribute('aria-label', 'Go to today: ' + dayNames[slot.day] + ' of week ' + slot.week);
  btn.addEventListener('click', function(){
    show('week-'+slot.week);
    showSub(slot.week+'-recipes');
    var target = document.getElementById('w'+slot.week+'-'+slot.day);
    if(target){
      target.scrollIntoView({behavior:'smooth', block:'start'});
      var card = target.querySelector('.card');
      if(card){ card.classList.add('flash'); setTimeout(function(){ card.classList.remove('flash'); }, 1800); }
    }
  });
})();
`;

const tabs = [
  ['overview', 'Overview'],
  ['fridays', 'Fridays'],
  ...WEEKS.map(w => [`week-${w}`, `Week ${w}`]),
  ['bank', 'Bank'],
];

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#2C2416">
<title>Family Food System</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<header>
  <h1>Family Food System<span class="sub">Friday to Thursday, four week rotation</span></h1>
  <button id="today" type="button">Today</button>
</header>
<nav class="tabs">
  ${tabs.map(([k, label], i) => `<button class="tab${i === 0 ? ' active' : ''}" data-tab="${k}">${label}</button>`).join('\n  ')}
</nav>
<main class="container">
${overviewPanel()}
${fridaysPanel()}
${WEEKS.map(weekPanel).join('\n')}
${bankPanel()}
</main>
<footer>Generated from data/ by tools/build.mjs, ${new Date().toISOString().slice(0, 16).replace('T', ' ')}</footer>
<script>${JS}</script>
</body>
</html>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, html);

const all = Object.keys(recipes).filter(k => !k.startsWith('_'));
const missing = all.filter(id => !macrosFor(id) && !recipes[id].alias);
console.log(`wrote ${outFile}`);
console.log(`  ${all.length} recipes across ${WEEKS.length} weeks`);
if (missing.length) console.log(`  ${missing.length} bank recipes still awaiting ingredients`);
