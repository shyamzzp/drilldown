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

Open `index.html` in a browser. Needs internet for the d3 CDN and the Supabase fetch.

## Data

Topics load at runtime from Supabase (table `drilldown_topics`, project `qsjrdhlaylhdnxkbbbof`), read-only for the anon key via RLS. `topics.js` holds the same hierarchies as an embedded fallback used when the fetch fails.

To add or edit topics:

1. Edit `topics.js` (plain nested `{ name, desc, children }` objects)
2. Run `node scripts/seed.cjs` to upsert them into Supabase (needs a local `.env` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; not committed)
3. Commit and push so the fallback stays in sync

Content-only changes take effect via the seed alone; no redeploy needed.

## AI expansion

Ctrl+click (Cmd+click on Mac) any tile and the app generates 3 to 6 deeper sub-topics for it. Calls the Supabase Edge Function `ai-expand` (`supabase/functions/ai-expand/`), which proxies OpenRouter free models (`openrouter/free`, key stored as a Supabase secret, never in the client) and caches results in `drilldown_ai_expansions` so each node is generated once and shared by all visitors. Generated tiles are marked with a sparkle.

Deploy after changes: `supabase functions deploy ai-expand --project-ref qsjrdhlaylhdnxkbbbof`

## Comments

Press `c`, click any tile, write a comment; threads persist in `drilldown_comments` (anon read + insert via RLS). Commented tiles show a count badge.
