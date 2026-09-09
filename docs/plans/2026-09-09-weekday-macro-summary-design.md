# Weekday macro summary

*2026-09-09. Issue #65.*

A line at the top of every week saying what an average day in that week looks
like: whole day, per adult, averaged over Monday to Friday.

## What it covers

Three meals a day, five days:

- **Breakfast** - the overnight oats bag, `scaffold.breakfast_bags.recipe`.
- **Lunch** - `lunchboxDay(week, day)`, which already folds in that day's protein
  and finisher.
- **Dinner** - `perPortion(w.dinners[day])`.

Divided by five. The numbers are per adult: breakfast bags and lunchboxes are
both 10 a week, which is 2 adults x 5 weekdays, and dinners come in at one
portion each.

### Why Monday to Friday

Those are the five days the system is built to produce. Saturday lunch is
sandwiches, Sunday is the tuna pasta salad, and neither day has a breakfast bag
in `scaffold.json`. Dinner is the only meal that exists all seven nights.
Averaging the weekend in would drag the number down for reasons that are not
dietary, and I would learn nothing I would act on.

### Why Friday's dinner is the adults' plate

Friday is `scaffold:pizza`, which is three cards: the boys' margherita, that
week's adult topping, and a salad. The adult plate is
`friday_pizza_topping` + `friday_salad`, and that is what gets counted.

`menuPanel` skips the macro line on pizza night, but that is because the row
points at two different people's pizzas - a display problem, not a data one.
Friday is the heaviest dinner of the week and excluding it would flatter the
average.

### What it deliberately does not do

No targets, no percentage of a goal. There is nothing in `scaffold.json` that
says what I am aiming at, and inventing a target would be putting words in my
own mouth.

## The calculation

Two new exports in `tools/calc.mjs`, beside `lunchboxDay` because that is where
meal assembly already lives:

```js
export function weekdayAverage(weekId)      // -> {kcal, protein, carbs, fat, fibre}
export function weekdayAverageLine(weekId, {separator = ' - '} = {})
```

`weekdayAverageLine` formats with the existing `roundKcal` and `roundG`, so it
reads as a sibling of `macroLine` and `lunchboxDayLine` rather than a stranger.

Breakfast is added inside the per-day loop even though it is the same bag five
times over. That is the seam: I want smoothies to replace the oat bags, and when
they do, breakfast needs a per-day schedule the way `lunch_boxes.protein_schedule`
already does for lunch. Looping now means that is a lookup swap rather than a
rewrite. I am not building the schedule before there is a recipe to put in it.

## Where it renders

Inside the coloured week head in `weekPanel()`, not in the Menu subtab. The head
is the one element visible whichever subtab is open; under Menu it would vanish
the moment I tapped Basket.

```
Average weekday, per adult - ~1645 kcal - 98g protein - ...
```

`.week-head` is a single flex row, so it gains `flex-wrap: wrap` and the new
`.week-macro` gets `flex-basis: 100%`, dropping onto its own line inside the
band. It reuses the existing `font-size: .85rem; opacity: .85` treatment so it
reads as part of the header.

The wording carries both constraints - Monday to Friday, and one adult - because
~1645 kcal without them looks like a week that is starving the family.

The overview panel's rotation list is left alone. It is a four-item chooser and
five more numbers per row would turn a glance into a table.

## Verification

A new `tools/test-week-macros.mjs`, shaped like `test-recipe-mode.mjs`:

1. **Every week returns a figure** - five finite, non-zero numbers for all four
   weeks. Catches a rotation slot going `incomplete`, where `perPortion` returns
   zeroes and the average would sag silently instead of failing.
2. **Friday is really in there** - the average is strictly greater than the same
   average with Friday's dinner zeroed. Pins the pizza branch, so if
   `scaffold:pizza` stops matching it fails loudly instead of quietly dropping
   about 1000 kcal.
3. **The parts add up** - breakfast + lunchbox + dinner equals the day's
   contribution, so nothing is double counted through a `from` link.
4. **The line reaches the page** - one `.week-macro` per week in the built
   `docs/index.html`, each carrying a kcal figure.

Plus an addition to `audit.mjs` section 5: every weekday must have a
`protein_schedule` entry, because `lunchboxDay` returns `null` for a missing day
and a silent `null` would drop lunch out of the average.
