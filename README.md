# AWS AgentCore Interactive Treemap

Interactive, zoomable cascaded treemap of Amazon Bedrock AgentCore components, built with d3. Single HTML file, no build step.

**Live demo:** https://shyamzzp.github.io/agentcore-treemap/

## Features

- Drill-down navigation: start from one AWS AgentCore tile, click to explore components (Runtime, Gateway, Memory, Identity, Built-in Tools, Observability) down to leaf topics
- Detail drawer: click a leaf tile for a slide-in panel with full description
- Search: press `/`, type, jump straight to any component
- Breadcrumbs, Back button, Esc/Backspace to go up a level
- Deep links: URL hash tracks position (e.g. `#AWS AgentCore/Memory`), so any view is bookmarkable
- Full-viewport single-page layout, automatic light/dark mode, colorblind-safe palette

## Run locally

Open `index.html` in a browser. Needs internet for the d3 CDN.

## Edit content

All content lives in the `DATA` object at the top of the script in `index.html`: plain nested `{ name, desc, children | w }`. Edit and refresh.
