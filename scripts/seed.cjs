/* Seed/refresh drilldown_topics in Supabase from topics.js.
   Usage: node scripts/seed.cjs
   Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env next to the repo root. */

const fs = require("fs");
const path = require("path");

const TOPICS = require(path.join(__dirname, "..", "topics.js"));

function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv(path.join(__dirname, "..", ".env"));
const URL_ = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

(async () => {
  const rows = TOPICS.map((t, i) => ({
    slug: slugify(t.name),
    name: t.name,
    position: i,
    data: t,
    updated_at: new Date().toISOString()
  }));
  const res = await fetch(`${URL_}/rest/v1/drilldown_topics?on_conflict=slug`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) {
    console.error("Upsert failed:", res.status, await res.text());
    process.exit(1);
  }
  const out = await res.json();
  console.log("Upserted:", out.map(r => `${r.slug} (pos ${r.position})`).join(", "));
})();
