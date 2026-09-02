# Family Food System — Build Specification

## What this is

A data-driven family meal planning system that generates a complete, phone-friendly HTML site from JSON data files. It produces four weeks of dinners on a rotation, with a Saturday prep session, annotated shopping baskets, freezer banking, macro tracking, and a recipe bank.

The system is designed for two adults (active, targeting weight loss — running, swimming, climbing, weights) and two boys. All meals are cooked mild with heat added at the table for the adults. The ethos: remove 99.99% of thought from weekly food. One prep session on Saturday night produces almost everything for the week.

---

## Repo structure

```
family-food-system/
├── data/
│   ├── recipes.json          # Every recipe in the system
│   ├── foods.json            # Nutritional composition table (per 100g)
│   ├── rotation.json         # Which recipes go in which week/day/slot
│   └── scaffold.json         # Weekly constants (pizza, flapjacks, breakfast bags, etc.)
├── tools/
│   ├── calc.mjs              # Macro calculator
│   └── build.mjs             # Generates the HTML output from data
├── docs/
│   └── index.html            # Generated output — this is what GitHub Pages serves
├── SYSTEM-SPEC.md            # This file
└── README.md
```

GitHub Pages should serve from the `docs/` folder on the `main` branch.

---

## The weekly rhythm

### Lunch box protein

The base of a box is identical all week - dressing, rice, beans, roast veg, pickled onions, leaves. The protein is not part of it and changes by day, the same five-day rotation in every rotation week:

| Day | Protein | Built |
|---|---|---|
| Mon | 80g that week's roast tray | Saturday |
| Tue | 80g that week's roast tray | Saturday |
| Wed | 80g smoked mackerel | on the day |
| Thu | 80g cooked prawns | on the day |
| Fri | 80g tuna + 2 boiled eggs | on the day |

So the roast tray feeds four boxes, not ten. Only Monday and Tuesday's boxes are complete when they leave the Saturday session; the other six carry the base and get their protein added that morning.

A box therefore has five macro figures rather than one - `lunchboxDay(week, day)` in `calc.mjs` returns base + that day's protein + that day's finisher. Wednesday runs high on fat because oily fish is the point of that day, and the page labels it rather than leaving the number looking like an error.

The week runs **Friday (delivery) through Thursday**, anchored to delivery day. This is critical — `rotation.day_order` is Fri, Sat, Sun, Mon, Tue, Wed, Thu, and the basket, the cycle maths and the today button all count from it.

The week **tabs render** Sun, Mon, Tue, Wed, Thu, Fri, Sat, from `rotation.display_order`, because a list that starts on Friday and ends on Thursday reads oddly. Same seven days, same content, reading order only. Change `day_order` and you change the system; change `display_order` and you change what the page looks like.

```
Wed/Thu    Order online (open basket, add to trolley, book slot)
Thu bed    Pizza dough out of freezer into fridge
Friday     Delivery. Pizza night — every week, no exceptions.
Saturday   Sandwiches for lunch. PREP SESSION in the evening (2-3 hours).
           That night's dinner = the traybake, cooked during the session.
Sunday     Tuna pasta salad for lunch (made Saturday). Roast for dinner.
Monday     Leftovers from Sunday's roast, build-your-own. Together night.
Tue-Thu    Shift dinners — reheats, slow cooker, oven timers, quick-cook.
           Nothing requiring more than 15 minutes' active effort.
Wed bed    Thursday's freezer bag from freezer into fridge.
```

---

## Data schemas

### recipes.json

A flat object keyed by recipe ID. Every recipe that the system uses — dinners, batch pots, freezer bags, traybakes, scaffold items (flapjacks, dressings, etc.), lunch box specs, salads, pizza variants.

```jsonc
{
  "chilli": {
    "name": "Mild Chilli, Double Batch",
    "category": "batch-pot",        // batch-pot | freezer-bag | traybake | roast | leftover-transform | scaffold | salad | pizza | lunchbox
    "week": 1,                      // Primary week in rotation (null for scaffold/bank items)
    "day": "sat",                   // Primary day (null if multi-day)
    "serves": 12,                   // Total portions this recipe makes
    "splits": {                     // How those portions get divided
      "tue": 4,
      "wed": 4,
      "freezer": 4
    },
    "tags": {
      "prepStyle": "batch",         // batch | cook-serve | reheat-only | assemble | quick-cook
      "freezerSafe": true,
      "reheatable": true,
      "slowCooker": false,
      "ovenTimer": false,
      "season": "all-year",         // all-year | winter | summer
      "activeMinutes": 15,
      "passiveMinutes": 60,
      "source": "system"            // system | emily-english | batch-cook
    },
    "notes": "Simmer 50-60 mins lid half off. Chocolate in at the very end. Nothing hot goes in the pot — heat at the table.",
    "ingredients": [
      // Every ingredient MUST have a "food" key matching foods.json for macro calc
      // AND a "display" string for the recipe card
      // AND an "aisle" for basket grouping
      { "food": "beef_mince_5",       "grams": 1000, "display": "1kg 5% fat beef mince",           "aisle": "meat" },
      { "food": "onion",              "grams": 300,  "display": "2 onions, diced",                  "aisle": "fresh" },
      { "food": "garlic",             "grams": 12,   "display": "4 cloves garlic, crushed",         "aisle": "fresh" },
      { "food": "pepper",             "grams": 160,  "display": "1 red pepper, diced",              "aisle": "fresh" },
      { "food": "carrot",             "grams": 100,  "display": "1 large carrot, grated",           "aisle": "fresh" },
      { "food": "smoked_paprika",     "grams": 5,    "display": "2 tsp smoked paprika",             "aisle": "cupboard" },
      { "food": "cumin",              "grams": 5,    "display": "2 tsp ground cumin",               "aisle": "cupboard" },
      { "food": "ground_coriander",   "grams": 2.5,  "display": "1 tsp ground coriander",           "aisle": "cupboard" },
      { "food": "oregano",            "grams": 1,    "display": "1 tsp oregano",                    "aisle": "cupboard" },
      { "food": "tomato_puree",       "grams": 30,   "display": "2 tbsp tomato puree",              "aisle": "cupboard" },
      { "food": "chopped_tomatoes",   "grams": 800,  "display": "2 tins chopped tomatoes",          "aisle": "tinned" },
      { "food": "kidney_beans",       "grams": 480,  "display": "2 tins kidney beans, drained",     "aisle": "tinned" },
      { "food": "red_lentils",        "grams": 150,  "display": "150g red lentils",                 "aisle": "cupboard" },
      { "food": "beef_stock",         "grams": 600,  "display": "600ml beef stock (2 cubes)",       "aisle": "cupboard" },
      { "food": "worcestershire",     "grams": 15,   "display": "1 tbsp Worcestershire sauce",      "aisle": "cupboard" },
      { "food": "dark_chocolate",     "grams": 15,   "display": "15g dark chocolate (70%+)",        "aisle": "cupboard" }
    ],
    "method": [
      "Brown the mince in the biggest pot, breaking it up. Drain any excess fat.",
      "Onion, garlic, pepper and carrot in for 5 minutes until softened.",
      "Spices and tomato puree for 1 minute, stirring.",
      "Everything else in except the chocolate. Simmer 50-60 minutes, lid half off, stirring occasionally.",
      "Chocolate in at the very end, stir until melted. Salt to taste.",
      "Split: a tub for Tuesday, a tub for Wednesday, one bag labelled CHILLI + month for the freezer."
    ],
    "serving_suggestion": "With rice pouches and Greek yoghurt. Flakes at the table for the adults.",
    "basket_notes": {
      "beef_mince_5": "the double chilli",
      "dark_chocolate": "15g — one or two squares, not a whole bar"
    }
  }
  // ... all other recipes follow the same schema
}
```

### foods.json

Already exists in System A. Extend as needed for new ingredients. Per 100g values (per 100ml for liquids): `[kcal, protein, carbs, fat, fibre]`. Typical UK supermarket / CoFID figures.

#### Conventions

These are load-bearing. A number in this table means nothing without them, and the file carries them as `_convention_*` keys so they travel with the data. `calc.mjs` looks foods up by key and never iterates the table, so those keys are inert.

**Raw weights go with raw values** — cooking loses water, not calories.

**The basis lives in the key suffix.** Where a food is used on more than one basis it gets one key per basis, and the recipe picks the matching one:

| Suffix | Means | Example |
|---|---|---|
| `_dry` | As weighed from the packet | `pasta_dry`, `brown_rice_dry`, `red_lentils_dry` |
| `_cooked` | Weighed after cooking | `quinoa_cooked`, `green_lentils_cooked` |
| `_raw` | Uncooked, where a cooked twin exists | `prawns_raw` vs `prawns_cooked` |
| `_drained` | Tin drained — the weight on the can | `kidney_beans_drained`, `sweetcorn_drained` |
| `_made` | Made up to drinking strength | `stock_made`, `gravy_made` |
| `_oil` | Packed in oil, drained | `anchovies_oil`, `sun_dried_tomatoes_oil` |

`pasta_dry` and `quinoa_cooked` sitting in one table on opposite bases is deliberate, not an inconsistency.

**Values are for the edible portion** — root veg peeled, olives pitted, meat off the bone. Two consequences worth knowing:

- `sweet_potato` `[86, 1.6, 20.0, 0.1, 3.0]` is flesh only, but Chilli-Loaded Sweet Potatoes is eaten skin and all, so that dish slightly **under**-counts fibre.
- Recipe `grams` are bought/prepped weight as the thing hits the pan. Whole veg eaten skin-on therefore multiplies a bought weight by a flesh-only rate and **over**-counts by roughly the weight of the skin — 5-10% of that one ingredient. Left alone: it errs high, which is the safe direction for a lean-and-fit goal.

**Bone is never counted as meat.** Either use a key that already prices the bone in (`chicken_thigh_bonein`), or split the ingredient into a `basketOnly` line for what is bought and a `macroOnly` line for what is eaten.

When adding a food, if its basis is not obvious from the name, add the suffix rather than relying on the reader to guess.

```jsonc
{
  "beef_mince_5": [137, 21.0, 0, 5.4, 0],
  "chicken_thigh_boneless": [121, 18.6, 0, 5.0, 0],
  // ... etc. Copy System A's existing file and extend.
  // New entries needed:
  "worcestershire": [78, 1.0, 18.0, 0, 0],
  "dark_chocolate": [546, 5.0, 46.0, 31.0, 11.0],
  "ground_coriander": [298, 12.0, 55.0, 18.0, 42.0],
  "cumin": [375, 18.0, 44.0, 22.0, 11.0],
  "smoked_paprika": [282, 14.0, 54.0, 13.0, 35.0],
  "oregano": [265, 9.0, 69.0, 4.0, 43.0],
  "fennel_seeds": [345, 16.0, 52.0, 15.0, 40.0],
  "sesame_oil": [884, 0, 0, 100.0, 0],
  "soy_sauce": [60, 8.0, 5.0, 0, 0],
  "harissa": [180, 3.0, 8.0, 15.0, 4.0],
  "sun_dried_tomato_paste": [213, 5.0, 20.0, 12.0, 5.0],
  "balsamic": [88, 0.5, 17.0, 0, 0],
  "korma_paste": [250, 3.0, 15.0, 20.0, 3.0],
  "coconut_milk_light": [97, 1.0, 1.5, 10.0, 0],
  "chicken_sausage": [130, 18.0, 3.0, 5.0, 0],
  "butternut_squash": [45, 1.0, 12.0, 0.1, 2.0],
  "sweet_potato": [86, 1.6, 20.0, 0.1, 3.0],
  "creme_fraiche_half": [165, 3.0, 4.0, 15.0, 0],
  "ricotta": [174, 11.0, 3.0, 13.0, 0],
  "linguine_dry": [350, 12.0, 70.0, 1.8, 3.0],
  "prawns_raw": [70, 15.0, 0, 1.0, 0],
  "salmon_fillet": [208, 20.4, 0, 13.4, 0],
  "quinoa_cooked": [120, 4.4, 21.3, 1.9, 2.8],
  "avocado": [160, 2.0, 9.0, 15.0, 7.0],
  "mango": [60, 0.8, 15.0, 0.4, 1.6],
  "chickpeas": [119, 7.2, 16.0, 2.6, 6.0]
}
```

### rotation.json

Maps weeks to recipe IDs for every slot.

```jsonc
{
  // The logical week - anchored to Friday delivery. Do not reorder.
  "day_order": ["fri", "sat", "sun", "mon", "tue", "wed", "thu"],
  // The reading order used by the week tabs. Display only.
  "display_order": ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
  "weeks": {
    "1": {
      "theme": "Mexican / Chicken",
      "roast": "roast_two_chickens",
      "traybake": "paprika_chicken_traybake",
      "batch_pot": "chilli",
      "freezer_bag": "pulled_chicken_bag",
      "dinners": {
        "fri": "scaffold:pizza",
        "sat": "paprika_chicken_traybake",
        "sun": "roast_two_chickens",
        "mon": "chicken_fajita_bowls",
        "tue": "chilli_with_rice",
        "wed": "chilli_loaded_sweet_potatoes",
        "thu": "pulled_chicken_bag"
      },
      "lunchbox_protein": "roast_chicken_stripped",
      "lunchbox_dressing": "house_vinaigrette",
      "lunchbox_finishers": {
        "mon": "20g tortilla chips crushed, squeeze of lime",
        "tue": "30g cheddar cubed, chilli flakes",
        "wed": "60g sweetcorn and chopped coriander",
        "thu": "A boiled egg with smoked paprika",
        "fri": "40g Greek yoghurt with chipotle or paprika"
      },
      "friday_salad": "chopped_salad_w1",
      "friday_pizza_topping": "chorizo_pepper_pizza",
      "flapjack_variant": "plain_seed",
      "dressing": "house_vinaigrette",
      "seasonal_swaps": {
        "summer": {
          "wed": "rainbow_couscous"
        }
      }
    },
    "2": {
      "theme": "Curry / Pork",
      "roast": "slow_roast_pork",
      "traybake": "salmon_traybake_glazed",
      "batch_pot": "dal",
      "freezer_bag": "korma_bag",
      "dinners": {
        "fri": "scaffold:pizza",
        "sat": "salmon_traybake_glazed",
        "sun": "slow_roast_pork",
        "mon": "tandoori_chicken_bowls",
        "tue": "dal_with_rice",
        "wed": "pork_fried_rice",
        "thu": "korma_bag"
      },
      "lunchbox_protein": "tandoori_thighs",
      "lunchbox_dressing": "mint_yoghurt",
      "lunchbox_finishers": {
        "mon": "1 tbsp mango chutney and coriander",
        "tue": "A boiled egg with toasted cumin seeds",
        "wed": "20g toasted seeds and nuts with garam masala",
        "thu": "Lime pickle, or more chutney for a milder one",
        "fri": "50g cucumber ribbons and extra mint yoghurt"
      },
      "friday_salad": "cucumber_tomato_salad_w2",
      "friday_pizza_topping": "tandoori_chicken_pizza",
      "flapjack_variant": "cinnamon_raisin",
      "dressing": "mint_yoghurt",
      "seasonal_swaps": {
        "summer": {
          "tue": "sesame_ginger_chicken_salad"
        }
      }
    },
    "3": {
      "theme": "North African / Gammon",
      "roast": "gammon_roast",
      "traybake": "harissa_chicken_squash_traybake",
      "batch_pot": "north_african_chickpea_stew",
      "freezer_bag": "chicken_olive_tomato_bag",
      "dinners": {
        "fri": "scaffold:pizza",
        "sat": "harissa_chicken_squash_traybake",
        "sun": "gammon_roast",
        "mon": "chicken_wraps",
        "tue": "chickpea_stew_with_couscous",
        "wed": "gammon_eggs_chips",
        "thu": "chicken_olive_tomato_bag"
      },
      "lunchbox_protein": "roast_chicken_lemon",
      "lunchbox_dressing": "lemon_dressing",
      "lunchbox_finishers": {
        "mon": "30g feta and oregano",
        "tue": "20g olives halved, and lemon zest",
        "wed": "40g hummus with smoked paprika",
        "thu": "A boiled egg with toasted seeds",
        "fri": "60g cucumber and extra lemon dressing"
      },
      "friday_salad": "greek_salad_w3",
      "friday_pizza_topping": "halloumi_pepper_pizza",
      "flapjack_variant": "lemon_seed",
      "dressing": "lemon_dressing",
      "seasonal_swaps": {
        "summer": {
          "sun": "salmon_sexy_veg",
          "wed": "sticky_peanut_stir_fry"
        }
      }
    },
    "4": {
      "theme": "Italian / Beef",
      "roast": "roast_beef_topside",
      "traybake": "meatball_al_forno",
      "batch_pot": "ragu",
      "freezer_bag": "sausage_pepper_bag",
      "dinners": {
        "fri": "scaffold:pizza",
        "sat": "meatball_al_forno",
        "sun": "roast_beef_topside",
        "mon": "lasagne",
        "tue": "ragu_with_pasta",
        "wed": "beef_tomato_orzo",
        "thu": "sausage_pepper_bag"
      },
      "lunchbox_protein": "meatballs_from_traybake",
      "lunchbox_dressing": "balsamic_vinaigrette",
      "lunchbox_finishers": {
        "mon": "30g mozzarella pearls and oregano",
        "tue": "15g parmesan and a splash of balsamic",
        "wed": "20g pepperoni and chilli oil",
        "thu": "A boiled egg with toasted seeds",
        "fri": "2 tbsp meatball tray sauce, with parmesan"
      },
      "friday_salad": "tomato_mozzarella_salad_w4",
      "friday_pizza_topping": "pepperoni_pizza",
      "flapjack_variant": "cocoa",
      "dressing": "balsamic_vinaigrette",
      "seasonal_swaps": {
        "summer": {
          "tue": "pesto_prawn_courgetti_linguine"
        }
      }
    }
  }
}
```

### scaffold.json

Things that happen every single week regardless of which rotation week it is.

```jsonc
{
  "friday_pizza": {
    "boys": {
      "recipe": "margherita_pizza",
      "notes": "2 dough balls, passata, 2 balls mozzarella. Method on the pizza page."
    },
    "adults": {
      "notes": "1 dough ball, passata, that week's topping, less mozzarella than the boys'. Topping under the cheese."
    }
  },
  "saturday_lunch": {
    "recipe": "sandwiches",
    "notes": "Cold lunch — bread, ham, cheddar, salad, pickled onions. Double filling on the adults'."
  },
  "sunday_lunch": {
    "recipe": "tuna_pasta_salad",
    "notes": "Made Saturday. Yoghurt and seeds added on Sunday."
  },
  "breakfast_bags": {
    "count": 10,
    "recipe": "overnight_oats_bag",
    "per_bag_frozen": {
      "oats": 40,
      "chia_seeds": 12,
      "protein_powder": 25,
      "greek_yoghurt_0": 100
    },
    "added_morning": {
      "water_or_milk": 100,
      "frozen_berries": 50
    },
    "notes": "Fill all bags one ingredient at a time, standing open in a tub. Seal, squish to mix, freeze flat. One bag from freezer to fridge each night. Morning: tip into bowl, add 100ml water or milk, stir. Berries on top. Banana on the side on training days. 5g creatine in a glass of water separately."
  },
  "boiled_eggs": {
    "count": 8,
    "method": "Boiling water, 8 min, straight into cold water. Keep in shells in the fridge.",
    "usage": "2 in tuna pasta salad, 4 in Friday salad, 1 in Thursday lunch box, 1 spare"
  },
  "pickled_onions": {
    "recipe": "quick_pickled_red_onions",
    "frequency": "Every Saturday, or skip if the jar from last week is still good (keeps 4-6 weeks)"
  },
  "flapjacks": {
    "frequency": "Every Saturday, first thing in the oven at 180°C",
    "base_recipe": "flapjack_base",
    "notes": "Variant changes per week — see rotation.json"
  },
  "lunch_boxes": {
    "count_per_adult": 5,
    "total": 10,
    "base_per_box": {
      "dressing": "2 tbsp (that week's dressing)",
      "grains": "half a rice pouch (125g)",
      "beans": "50g tinned beans, drained",
      "roast_veg": "100g from Saturday's veg tray",
      "pickled_onions": "a spoonful",
      "leaves": "a handful (~15g)"
    },
    // The protein is NOT part of the base - it changes by day. "week" means
    // that week's roast tray; anything else is a recipe id of its own.
    "protein_schedule": {
      "mon": { "source": "roast",         "grams": 80, "recipe": "week" },
      "tue": { "source": "roast",         "grams": 80, "recipe": "week" },
      "wed": { "source": "smoked_mackerel","grams": 80, "recipe": "lunchbox_mackerel" },
      "thu": { "source": "prawns",        "grams": 80, "recipe": "lunchbox_prawns" },
      "fri": { "source": "tuna_and_eggs", "grams": 80, "recipe": "lunchbox_tuna_egg" }
    },
    "finishers": "See rotation.json — different every day, the variety comes from these",
    "build_notes": "Bottom-to-top so leaves stay out of the dressing. Finisher last. Crunchy ones and boiled eggs go on the day, not in the box Saturday."
  },
  "dressings": {
    "monthly_batch": ["house_vinaigrette", "lemon_dressing", "balsamic_vinaigrette"],
    "weekly": ["mint_yoghurt"],
    "notes": "Make the three oil-based dressings in jars on Day 1 of the cycle. They keep 3-4 weeks. Mint yoghurt is weekly — only needed in Week 2."
  },
  "freezer_bank": {
    "cycle_1": {
      "description": "Double the freezer bags (2 per week instead of 1). Batch pots also bank 1 bag each. Goal: ~9 dinners banked by end of month.",
      "weekly_bags": 2,
      "pot_bags": 1
    },
    "cycle_2_onwards": {
      "description": "Single freezer bags only. Batch pots still bank 1 bag. Freezer grows slowly.",
      "weekly_bags": 1,
      "pot_bags": 1
    },
    "freezer_week": "When the tub holds 8+ bags, skip a cook session. Shop only fresh things. Eat 5 bags that week, oldest first."
  },
  "defaults": {
    "delivery_day": "fri",
    "week_start_day": "sun",
    "anchor_date": "2026-08-28",
    "current_cycle": "auto",
    "cycle_length_days": 28,
    "notes": "Defaults for the settings panel, and what the build falls back to. delivery_day is slot 0 of day_order; every other slot counts from it. current_cycle 'auto' works it out from the anchor."
  }
}
```

---

## The build script (build.mjs)

This script reads all four data files and generates `docs/index.html`. It should:

### 1. Compute macros
For every recipe, iterate its ingredients, look up each `food` key in `foods.json`, multiply by grams/100, sum across all ingredients, divide by `serves`. Output: `{ kcal, protein, carbs, fat, fibre }` per portion. Round kcal to nearest 5, grams to whole numbers.

For recipes with `splits` (like the chilli), also compute per-portion values for the specific serving context (e.g. "1/12 of the pot + half a rice pouch + 2 tbsp yoghurt").

### 2. Generate shopping baskets
For each week (1-4), aggregate all ingredients across:
- That week's dinners (from rotation.json)
- The scaffold items (pizza, breakfast bags, flapjacks, eggs, lunch boxes, dressings, sandwiches, tuna pasta salad)
- The freezer bags (doubled in cycle 1 — generate both a cycle-1 and cycle-2 basket)

Group by aisle: Meat & Fish, Dairy, Fruit & Veg, Frozen, Tinned, Cupboard.

Annotate each item with its downstream uses (which recipes need it, how much for each). Use `basket_notes` from recipes where provided, otherwise auto-generate from recipe names.

### 3. Generate the Saturday cook-through
For each week, produce an ordered sequence of steps for the Saturday session. The order is:
1. Flapjacks (first in the oven, 180°C)
2. Veg tray for lunch boxes (200°C, once flapjacks are out)
3. Lunch box protein (marinated/roasted, same time as veg tray)
4. The traybake — tonight's dinner (200°C, goes in alongside or after the veg)
5. The batch pot (on the hob, simmering while oven work runs)
6. Boiled eggs (while the pot simmers)
7. Cold work: freezer bags assembled, breakfast bags filled, dressings made, pickles done, tuna pasta salad made
8. Build the lunch boxes (last step, once everything has cooled enough)
9. Divide and label: which tubs go in the fridge, which bags go in the freezer

Each step should include the full recipe (ingredients and method) inline so the cook never needs to tab-hop. This is critical — the cook-through page is the single most important output and must be self-contained.

### 4. Generate the HTML
The output HTML should follow System A's design patterns:
- Dark header with "Today" button that auto-detects which week/day it is
- Tab navigation: Overview, Week 1, Week 2, Week 3, Week 4, Recipe bank
- Each week has sub-tabs: Menu, Basket, Saturday (cook-through), Recipes (per-day cards)
- Each recipe card shows: name, ingredients, method, macros, serving suggestion
- Basket items are tappable (checkbox to mark as added to trolley)
- Mobile-first, works well on phone screens
- Colour-coded weeks (use System A's colour scheme)
- `data-macro` attributes on macro display elements for the calc script to target

### 5. The "today" button
Uses the anchor date and cycle length to calculate which rotation week and which day of that week today falls on. Tapping it navigates straight to that day's recipe card.

---

## Complete recipe list to implement

### Batch pots

**Week 1 — Mild Chilli (double batch, 12 portions)**
1kg 5% fat beef mince · 2 onions diced · 4 cloves garlic crushed · 1 red pepper diced · 1 large carrot grated · 2 tsp smoked paprika · 2 tsp ground cumin · 1 tsp ground coriander · 1 tsp oregano · 2 tbsp tomato puree · 2 tins chopped tomatoes · 2 tins kidney beans drained · 150g red lentils · 600ml beef stock (2 cubes) · 1 tbsp Worcestershire sauce · 15g dark chocolate (70%+)
Method: Brown mince, drain fat. Onion/garlic/pepper/carrot 5 mins. Spices and puree 1 min. Everything else in except chocolate. Simmer 50-60 mins lid half off. Chocolate at the end, stir until melted. Split: tub for Tue, tub for Wed, 1 bag frozen labelled CHILLI + month.

**Week 2 — Dal (8 portions)**
500g red lentils rinsed · 2 onions diced (or 200g frozen) · 3 cloves garlic crushed (or 3 cubes) · thumb-sized piece fresh ginger grated (or 2 cubes) · 2 tsp turmeric · 2 tsp cumin · 1 tin chopped tomatoes · 1 tin light coconut milk · 1 tin chickpeas drained · 1.2L vegetable stock · 100g frozen spinach · 1 tsp garam masala · juice of half a lemon
Method: Onion, garlic and ginger in oil 3 mins. Turmeric and cumin 1 min. Lentils, chickpeas, tomatoes, coconut milk and stock in. Simmer 30 mins. Spinach and garam masala last 5 mins. Lemon juice at the end. Salt. Optional tarka for adults: 1 tbsp oil, 1 tsp mustard seeds, 1 tsp cumin seeds, pinch chilli flakes — fry 30 secs and pour over adults' bowls only. Split: tub for Tue, 1 bag frozen labelled DAL + month.

**Week 3 — North African Chickpea & Sweet Potato Stew (8 portions)**
2 tins chickpeas drained · 1 large sweet potato cubed · 2 onions diced · 4 cloves garlic crushed · 2 tsp smoked paprika · 1 tsp ground coriander · 2 tins chopped tomatoes · 500ml vegetable stock · 200g frozen spinach · 1 tbsp honey · juice of 1 lemon · salt
Method: Onion and garlic 5 mins. Spices 1 min. Sweet potato, chickpeas, tomatoes, stock in. Simmer 25-30 mins until sweet potato is soft. Spinach last 5 mins. Honey and lemon at the end. Salt. Harissa stirred into adults' bowls. Serve with couscous. Split: tub for Tue, 1 bag frozen labelled CHICKPEA STEW + month.

**Week 4 — Beef Ragù (double batch, ~12 portions)**
1kg 5% fat beef mince · 2 onions finely diced · 2 carrots finely diced · 2 celery sticks finely diced · 4 cloves garlic crushed · 200ml red wine (or 2 tbsp balsamic + extra stock for alcohol-free months) · 2 tins chopped tomatoes · 500g passata · 2 tbsp tomato puree · 500ml beef stock (2 cubes) · 1 tsp oregano · 2 bay leaves · parmesan rind if available
Method: Brown mince in batches, set aside. Soffritto (onion, carrot, celery) in the same pot 8-10 mins — low heat, don't brown, just sweat. Garlic 1 min. Wine in, reduce 3-4 mins. Mince back. Tomatoes, passata, puree, stock, herbs in. Simmer 1.5-2 hours lid off, stirring occasionally. Should be thick enough that a spoon leaves a trail. Remove bay leaves and parmesan rind. Split: tub for Tue (pasta), assembled lasagne for Mon (ragù + white sauce + pasta sheets + cheese, fridge raw), 1 bag frozen labelled RAGÙ + month.

**Week 4 — Minestrone (8 portions, also made Saturday)**
2 tins cannellini beans drained · 150g red lentils · 2 onions diced (or 200g frozen) · 3 cloves garlic crushed · 2 carrots diced · 2 celery sticks diced · 1 courgette diced · 2 tins chopped tomatoes · 1 tbsp tomato puree · 1.4L vegetable stock · 1 tsp oregano · 1 bay leaf · 1 parmesan rind · 100g frozen spinach · 100g pancetta or bacon lardons (optional, for protein)
Method: Pancetta fried 3 mins if using. Onion, garlic, carrot, celery, courgette 5 mins. Tomato puree 1 min. Everything else except spinach and pasta. Simmer 25 mins. Spinach last 5 mins. Remove bay leaf and parmesan rind. DO NOT add pasta to the pot. Split: tub for Wed or Thu, 1 bag frozen labelled MINESTRONE + month. Add 100g soup pasta per 4 portions when reheating — simmer 8 mins.

### Freezer bags (raw, assembled Saturday, slow-cooked Thursday)

**Week 1 — Pulled Chicken (per bag, 4 portions)**
6 boneless thighs (~600g) · 150g frozen onion · 2 garlic cubes · 2 tsp smoked paprika · 1 tsp cumin · 1 tbsp honey · 1 tbsp tomato puree · 1 tbsp cider vinegar · 200ml passata · 1 chicken stock cube crumbled

**Week 2 — Chicken & Chickpea Korma (per bag, 4 portions)**
6 boneless thighs (~600g) · half jar korma paste · 1 tin chickpeas drained · 150g frozen onion · 1 tin light coconut milk · 1 tsp garam masala · handful frozen spinach
Serve with yoghurt on the side (not in the bag).

**Week 3 — Chicken, Olive & Tomato (per bag, 4 portions)**
6 boneless thighs (~600g) · 80g olives · 1 tin chopped tomatoes · 150g frozen onion · 2 garlic cubes · 1 tsp oregano · 1 tbsp sun-dried tomato paste · 1 red pepper chunked · 1 chicken stock cube · squeeze of lemon
Fresh basil torn over when serving.

**Week 4 — Italian Sausage & Pepper (per bag, 4 portions)**
6 chicken sausages (Heck or similar) cut into 3 chunks each · 1 tin chopped tomatoes · 150g frozen onion · 2 garlic cubes · 1 red pepper chunked · 1 yellow pepper chunked · 1 tsp oregano · 1 tsp smoked paprika · 1 tbsp tomato puree · 1 chicken stock cube crumbled · pinch of sugar

**All bags:** Everything raw into the bag. Freeze flat. Wednesday night into the fridge. Thursday morning into the slow cooker on low. Warm until the last one's home. Serve with rice pouches or pasta.

**Cycle 1:** Make 2 bags per week (1 for Thursday, 1 banked). **Cycle 2 onwards:** 1 bag only.

### Traybakes (Saturday dinner, cooked during the prep session)

**Week 1 — Paprika Chicken Traybake (4 portions)**
8 bone-in chicken thighs (~1.2kg) · 2 red peppers chunked · 1 red onion in wedges · 600g sweet potato chunked · 4-6 unpeeled garlic cloves · 2 tbsp oil · 2 tsp smoked paprika · 1 lemon · salt
Method: 200°C. Sweet potato, peppers, onion and garlic in first with oil, paprika and salt — 15 mins head start. Chicken on top, 35-40 mins more. Lemon squeezed over. Adults: 2 tbsp yoghurt with 1 tsp harissa each, on the side.

**Week 2 — Glazed Salmon Traybake (4 portions)**
4 salmon fillets · 500g baby potatoes halved · 1 head broccoli in florets · 150g cherry tomatoes halved · 2 tbsp oil · 1 lemon · dried herbs · salt
Glaze: 1 tbsp soy sauce + 1 tbsp honey + juice of half the lemon
Method: 200°C. Potatoes in with oil and salt, 20 mins alone. Broccoli and tomatoes in, glazed salmon on top. 15 more mins. Fresh dill or parsley scattered at the end.

**Week 3 — Harissa Chicken with Squash & Chickpeas (4 portions)**
8 bone-in chicken thighs (~1.2kg) · 1 butternut squash cubed · 1 tin chickpeas drained · 1 red onion in wedges · 2 tbsp harissa (mild) · 2 tbsp oil · drizzle of honey · salt
Method: 200°C. Squash, chickpeas and onion in with oil and harissa — 15 mins head start. Chicken on top, 35-40 mins more. Honey drizzled over. Adults: extra harissa at the table.

**Week 4 — Meatball & Ricotta Al Forno (doubled, 8 portions — Emily English recipe)**
1kg 5% fat minced beef · 16 tbsp ricotta · 2 lemons (zest) · 160g wholemeal breadcrumbs · 100g parmesan · 2 eggs · 2 bunches fresh basil · 2 tbsp olive oil · 2 courgettes diced · 2 red peppers diced · 2 red onions diced · 2 cloves garlic · 2 tbsp sun-dried tomato paste · 2 tbsp tomato puree · 2 tins butter beans · 2 tsp smoked paprika · 1kg passata · 2 chicken stock cubes · 4 tbsp balsamic vinegar
Method: Form meatballs (don't over-mix). Brown in batches. Sauce: veg 5 mins, garlic 1 min, tomato paste and puree 1 min, beans, paprika, passata, stock, balsamic. Simmer 10 mins. Meatballs into sauce, parmesan and ricotta dotted on top. 220°C (fan 200°C) 15-20 mins. One tray is dinner. Second tray: meatballs portioned for lunch boxes and freezer.

### Leftover transforms (midweek, minimal effort)

**W1 Mon — Chicken Fajita Bowls:** Shredded roast chicken (350g) warmed or cold. Rice pouches. Peppers fried with fajita spice (5 mins). Cucumber, leaves, yoghurt, pickled onions. Lime wedges and coriander. Build your own.

**W1 Wed — Chilli-Loaded Sweet Potatoes:** 4 sweet potatoes on a 45-min oven timer at 200°C. Reheat chilli. Cheddar (80g) and yoghurt (160g) on top.

**W2 Mon — Tandoori Chicken Bowls:** Tandoori thighs from Saturday (warm or cold). Rice pouches. Cucumber, leaves, mint yoghurt dressing, mango chutney. Build your own.

**W2 Wed — Pork Fried Rice:** 300g leftover pork diced, crisped 3 mins. 2 rice pouches broken in. 300g frozen stir fry veg. 3 eggs scrambled. 2 tbsp soy, 1 garlic cube. 1 tsp sesame oil at the end. Spring onions on top. Make the lot at first sitting, microwave per person after.

**W3 Mon — Chicken Wraps:** Same roast chicken + salad components as other Mondays but in warm tortillas instead of bowls over rice. Lemon dressing.

**W3 Wed — Gammon, Eggs & Sweet Potato Chips:** Leftover gammon sliced (~400g). Sweet potato chips part-cooked Saturday (200°C, 15 mins), finished Wednesday (200°C, 20 mins from fridge). Fried eggs on the day.

**W4 Mon — Lasagne:** Cold-assembled Saturday from ragù + white sauce (jar or béchamel) + pasta sheets + mozzarella and cheddar on top. Optional spinach layer. Bake from fridge 190°C, 40 mins on a timer.

**W4 Wed — Beef & Tomato Orzo:** 200g orzo cooked in 500ml stock with 1 tin chopped tomatoes, simmered 10-12 mins. 1 diced courgette or handful frozen peas in for last 3 mins. Leftover roast beef shredded in for last 2 mins only. Lemon zest and parmesan over.

### Emily English / Batch Cook recipes (in the bank, classified)

These should all be in `recipes.json` with full ingredient lists. They're available for summer swaps, schedule-dependent slots, or together nights. Include their current tags from the grading:

| ID | Name | Source | Classification |
|---|---|---|---|
| ee_goulash | Goulash | Batch Cook p.140 | Rotation-ready (W1 batch pot alternative, winter) |
| ee_veggie_bol | Superfood Vegetarian Bolognese | Emily English p.132 | Rotation-ready (W2 batch pot alternative) |
| ee_meatball | Meatball & Ricotta Al Forno | Emily English p.122 | Rotation-ready (W4 traybake — IN ROTATION) |
| ee_chicken_orzo | One-Pot Mediterranean Chicken Orzo | Batch Cook p.194 | Rotation-ready with tweak |
| ee_rainbow_couscous | Rainbow Couscous | Batch Cook | Summer cold/assemble |
| ee_sesame_ginger | Toasted Sesame & Ginger Chicken Salad | Emily English p.50 | Summer cold/assemble |
| ee_multivitamin | Nature's Multivitamin Salad | Emily English p.55 | Side salad only (low protein) |
| ee_mango_jalapeno | Mango, Jalapeño & Lime Salad | Emily English | Summer cold/assemble |
| ee_sushi_salad | Sushi Salad | Emily English | Summer cold/assemble |
| ee_ppcl | Pesto Prawn Courgetti Linguine | Emily English | Quick-cook (summer) |
| ee_stir_fry | Sticky Peanut Stir Fry | Emily English | Component prep / quick-cook |
| ee_salmon_veg | Salmon and Sexy Veg | Emily English p.126 | Component prep (summer W3 swap) |
| ee_risotto | Oven-Baked Risotto with Smoked Salmon & Peas | Batch Cook p.126 | Together night only |
| ee_italian_pasta | Italian Sausage & Broccoli Pasta | Emily English p.152 | Together night only |
| ee_gyoza_soup | Detox Gyoza Soup | Emily English | Schedule-dependent (WFH days) |

---

## Settings

A cog beside the Today button opens a right-hand panel. Four settings, stored as one `ffs-settings` object in `localStorage`, falling back to `scaffold.defaults`:

| Setting | Type | Default | Affects |
|---|---|---|---|
| `delivery_day` | Mon-Sun | `fri` | every slot label, the rhythm reminders, prep and roast days |
| `week_start_day` | Mon-Sun | `sun` | display order of the day cards, menu list and finishers |
| `anchor_date` | date | `2026-08-28` | the Today button, the auto cycle |
| `current_cycle` | auto / 1 / 2 | `auto` | which basket variant opens by default |

### Slots, not weekdays

`rotation.day_order` is a list of **slots**, not weekday names. Slot 0 is delivery day and every other slot is a fixed number of days after it, so prep is always delivery+1 and the roast delivery+2. Move delivery to Thursday and prep becomes Friday, the roast Saturday - the data does not change, only the labels.

The keys are still spelled `fri`, `sat`, `sun`... because that is where the defaults put them. Read them as slot ids.

### Computed day names in prose

Two tokens are substituted in any string carrying `data-tpl`:

- `{{day}}` - the weekday name of that element's own slot
- `{{d+N}}` - the weekday name at delivery + N days

Used in `scaffold.rhythm`, `scaffold.not_made_saturday` and the `cook_order` details. The build fills them from the defaults so the page is correct with JavaScript off; the client refills them when a setting changes.

### Adding a setting

One entry in `SETTINGS_SCHEMA` in `build.mjs` (key, label, type, default, optional note) plus a line in the client's `applySettings()`. The panel markup and the persistence are generated from the schema.

## Design / UI requirements

### Mobile-first
- The primary device is a phone propped up on the kitchen counter
- All text must be readable without zooming
- Tap targets must be large enough for flour-covered fingers
- The Saturday cook-through must scroll vertically — no horizontal swiping while cooking

### Navigation
- Top-level tabs: Overview | Week 1 | Week 2 | Week 3 | Week 4 | Recipe bank
- Within each week: Menu | Basket | Saturday | Recipes (sub-tabs per day)
- "Today" button in the header — prominent, always visible, auto-navigates to the right week and day

### Colours (follow System A)
- Week 1: warm terracotta
- Week 2: teal/green
- Week 3: deep blue
- Week 4: plum/purple
- Accent for adults-only content (harissa, chilli flakes etc): italic, slightly different colour

### Recipe cards
- Name, serving count, time
- Ingredients listed clearly
- Method as numbered steps
- Macro line: `~480 kcal · 32g protein · 54g carbs · 13g fat · 8g fibre (per portion, context)`
- Source attribution for Emily English recipes

### Basket
- Grouped by aisle
- Each item tappable (checkbox, strikethrough when tapped)
- Downstream uses annotated after each item in lighter text
- Cycle 1 vs Cycle 2 differences flagged clearly

### Saturday cook-through
- **This is the most important page.** It must read like a continuous, ordered instruction sheet.
- Numbered major steps (1. Flapjacks, 2. Into the oven, 3. On the hob, etc.)
- Full ingredient lists and methods inline — no "see the Tuesday tab"
- Timing cues: "while the pot simmers," "once the oven frees up"
- Clear markers for what goes where after cooking: "→ tub for Tuesday," "→ bag for freezer, labelled CHILLI + month"
- "Not made on Saturday" section at the end listing what still needs doing in the week

---

## Build & deploy

1. `node tools/build.mjs` reads the four JSON files and writes `docs/index.html`
2. `node tools/calc.mjs` can be run standalone to print macro tables for verification
3. Push to `main` branch → GitHub Pages auto-deploys from `docs/`
4. The generated HTML should include a build timestamp in a comment or footer

---

## What to build first

1. Set up the repo structure and GitHub Pages
2. Create `foods.json` (extend System A's existing file)
3. Create `recipes.json` with all recipes listed above
4. Create `rotation.json` and `scaffold.json`
5. Build `calc.mjs` (adapt from System A)
6. Build `build.mjs` — start with the Saturday cook-through pages (most critical) then basket generation, then the menu/recipe views
7. Style and polish the HTML output
8. Test the "Today" button logic

---

## Important notes for the builder

- **The Saturday cook-through is the product.** Everything else is supporting material. If only one thing works perfectly, it must be this.
- **Mild base, heat at the table.** Nothing spicy goes into any pot or tray. Adults' additions are marked clearly but kept separate.
- **The week runs Fri→Thu, not Mon→Sun.** Get this wrong and the whole system is offset.
- **Basket annotations matter.** "7 peppers" is useless. "7 peppers: 5 red and 2 yellow — 2 for the traybake, 1 in the chilli, 1 for Wednesday, 1 for the salad, 2 yellow for the fajita bowls" is the whole point.
- **Pasta/rice/orzo is ALWAYS cooked fresh on the day, never prepped Saturday.** It goes stodgy. The sauce, the stew, the ragù — those are Saturday. The carb is on the day.
- **Every Thursday is a freezer bag to slow cooker.** No exceptions.
- **The Emily English / Batch Cook bank recipes now carry gram weights** with `food` keys matching `foods.json`, so they compute macros like everything else. `ee_meatball` is the exception: it is an `alias` onto `meatball_al_forno`, the doubled tray already in rotation, rather than a second copy of the same dish.
