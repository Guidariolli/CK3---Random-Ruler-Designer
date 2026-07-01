# CK3 Random Ruler Generator

Static generator (pure HTML + JS, no backend) of random **Ruler Designer** characters for Crusader Kings III, respecting the **400-point** cap (achievement / ironman eligibility).

## How it works

Everything runs from a single `data.json` (loaded via `data.js`), extracted from the base game files:

- **222 selectable traits** (`ruler_designer_cost` defined and not hidden), each with `id`, `name`, `category`, `cost`, `opposites`, `group`/`level`, `modifiers` and `dlc`.
- **`config`**: 400-point cap (`IRONMAN_POINT_MAX`), attribute purchase cost bands (general and prowess) and the age-point curve (`AGE_LEVELS` x `AGE_LEVEL_MULTIPLIERS`).
- **Cultures** and **faiths** for the random draw.

### Generation rules
- At most **3 personality traits** (count rolled with a cascading probability: usually 1-2, sometimes 3).
- Exactly **1 education trait**.
- Never two traits on the same exclusion axis (`opposites` or same `group`).
- The six skills (Diplomacy, Martial, Stewardship, Intrigue, Learning, Prowess) are rolled and **cost points** per the band table (base value 5 is free; cost of a skill at value V = `table[V] - table[5]`).
- Total (age + skills + traits) **<= 400** when the *"achievement-eligible"* toggle is on; off removes the cap.
- You can **choose and lock** culture, faith and age (leave unlocked to randomize each roll).
- A **minimum points** slider fills the character with positive-cost traits up to the chosen floor.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Data is loaded from `data.js` (via `<script>`), so it also works by **double-clicking `index.html`**. `data.json` is kept for hosting and regeneration; if `data.js` is missing, the site falls back to `fetch("data.json")` (requires HTTP).

## Deploy to GitHub Pages / Vercel

- **GitHub Pages**: push `index.html`, `style.css`, `app.js`, `data.js`, `data.json`; in Settings -> Pages pick branch `main`, folder `/ (root)`.
- **Vercel**: import the repo (or drag the folder in vercel.com/new); it's a static site, framework preset **Other**, no build step.

## Regenerating `data.json`

`parse_ck3.py` reads the game files and re-emits `data.json`:

```bash
python3 parse_ck3.py "/path/to/Crusader Kings III/game" data.json
# then refresh data.js:
printf 'window.CK3_DATA = ' > data.js && cat data.json >> data.js && printf ';\n' >> data.js
```

## Notes

- `dlc` is a curated best-effort map: the base `00_traits.txt` carries no per-trait DLC tag, so most traits are `null` (base game). Traits clearly tied to a DLC (Roads to Power, All Under Heaven, Wandering Nobles, Tours and Tournaments) were mapped manually.
- `modifiers` holds only the trait's direct attribute/opinion bonuses, not the conditional `culture_modifier` blocks.
