# drilldown

Interactive, zoomable drill-down treemap for exploring any nested topic, built with d3. Single HTML file, no build step. Current topic: AWS Bedrock AgentCore.

**Live demo:** https://shyamzzp.github.io/drilldown/

## Features

- Drill-down navigation: start from one root tile, click to explore components down to leaf topics
- Detail drawer: click a leaf tile for a slide-in panel with full description
- Search: press `/`, type, jump straight to any node
- Breadcrumbs, Back button, Esc/Backspace to go up a level
- Deep links: URL hash tracks position (e.g. `#AWS AgentCore/Memory`), so any view is bookmarkable
- Full-viewport single-page layout, automatic light/dark mode, colorblind-safe palette

## Run locally

Open `index.html` in a browser. Needs internet for the d3 CDN.

## Swap or add topics

All content lives in the `DATA` object at the top of the script in `index.html`: plain nested `{ name, desc, children | w }`. Replace it with any topic hierarchy and refresh; the treemap, search, drawer, and deep links adapt automatically.
