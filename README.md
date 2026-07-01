# Unofficial CK3 Random Ruler Generator

A static, no-backend web tool that generates random **Ruler Designer** characters for Crusader Kings III, staying under the **400-point** cap (achievement / ironman eligibility).

> Unofficial fan-made tool. Not affiliated with, endorsed by, or sponsored by Paradox Interactive. Crusader Kings III is a trademark of Paradox Interactive AB.

## ✨ Features

- **Respects the 400-point cap.** The point math (trait costs, skill costs including how trait modifiers change what you pay, and the age curve) was reverse-engineered from the base game files and calibrated against real in-game totals until it matched exactly.
- **DLC filters.** Tick the DLCs you own and it only pulls traits you can actually use.
- **Focus builds.** Pick an attribute (Diplomacy, Martial, Stewardship, Intrigue, Learning, Prowess) and it builds around it — matching education, a high focus skill, and supporting traits — or go fully random.
- **Lock or randomize** culture, faith and age.
- **Minimum-points slider**, trait-category toggles, and an achievements on/off switch.
- Full breakdown (age / skills / traits), the six skills, all traits with their effects, plus a random culture and faith.
- Free, runs entirely in the browser, no login, no ads.

## 🚀 Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Data loads from `data.js` (via `<script>`), so it also works by double-clicking `index.html`. `data.json` is kept for reference and regeneration.

## 🌐 Deploy

- **GitHub Pages:** Settings → Pages → branch `main`, folder `/ (root)`.
- **Vercel:** import the repo — it's a static site, framework preset **Other**, no build step.

The site loads its background from `bg.jpg` (a compressed copy of `BG.png`, ~85% smaller for faster load) and its social preview from `og-image.jpg`. Make sure `bg.jpg`, `og-image.jpg`, `favicon.svg`, `robots.txt` and `sitemap.xml` are included in the deploy (they are just static files, so they ship automatically). `BG.png` is only needed to regenerate those.

> **SEO note:** the canonical URL, Open Graph/Twitter tags (in `index.html`), `robots.txt` and `sitemap.xml` all point to `https://ck3-random-ruler-designer.vercel.app/`. If your Vercel domain differs, update the URL in those files.

## 🔧 Regenerating the data

`parse_ck3.py` reads the game files and re-emits `data.json`:

```bash
python3 parse_ck3.py "/path/to/Crusader Kings III/game" data.json
# then refresh data.js:
printf 'window.CK3_DATA = ' > data.js && cat data.json >> data.js && printf ';\n' >> data.js
```

## ☕ Support

If you enjoy this tool, you can support its development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-FFDD00?style=flat&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/guidariolli)

## Notes

- `dlc` is a curated best-effort map: the base game files carry no per-trait DLC tag, so most traits are `null` (base game). Traits clearly tied to a DLC (Roads to Power, All Under Heaven, Wandering Nobles, Tours and Tournaments) were mapped manually.
- `modifiers` holds only a trait's direct attribute/opinion bonuses, not conditional `culture_modifier` blocks.
