# Family Food System

A four-week dinner rotation for a family of four, generated from JSON into
a single phone-friendly page. One prep session on Saturday night produces almost
everything for the week.

The week runs **Friday to Thursday**, anchored to delivery day. Get that wrong and
the whole system is offset.

## Layout

```
data/
  foods.json      nutritional composition per 100g
  recipes.json    every recipe: ingredients, method, macros, basket notes
  rotation.json   which recipe fills which slot in which week
  scaffold.json   what happens every week regardless of rotation
tools/
  calc.mjs        macro calculator, also the library build.mjs imports
  build.mjs       generates docs/index.html
docs/
  index.html      generated - this is what GitHub Pages serves
SYSTEM-SPEC.md    the specification this was built from
```

## Working on it

```sh
node tools/calc.mjs     # print the macro table for every recipe
node tools/build.mjs    # regenerate docs/index.html
```

Change a recipe, re-run the build, and the page catches up. Nothing on the page is
typed by hand.

## How the data fits together

Ingredients carry four things: a `food` key into `foods.json` for macros, a
`display` string for the recipe card, an `aisle` for the shopping basket, and the
gram weight everything is worked out from.

Two flags handle food that is bought and eaten in different places:

- `basketOnly` - bought here, not eaten here. Two whole chickens go on the
  shopping list, but only Sunday's share of the meat counts against Sunday.
- `macroOnly` - eaten here, bought elsewhere. Monday's leftover roast chicken
  counts towards Monday's macros but is not bought twice.

`from` pulls whole portions out of another recipe: Tuesday's dinner is four
portions of Saturday's chilli pot. The basket generator does not follow `from`
links, because the pot they point at is already on the list at full size.

## The Saturday cook-through

The most important page. Every step carries its full ingredient list and method
inline, so nobody has to tab away mid-cook. It is generated from
`scaffold.json`'s `cook_order` plus that week's recipes, and ends with where every
tub and bag goes.

## Deploying

GitHub Pages serves `docs/` from `main`. Push and it updates.