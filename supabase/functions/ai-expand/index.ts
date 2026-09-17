// AI expansion for drilldown tiles.
// POST { path, name, desc, existing: [names] } -> { children: [{name, desc}], cached }
// Results are cached in drilldown_ai_expansions so each node is generated once.
import { createClient } from "npm:@supabase/supabase-js@2";

const OR_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const MODEL = "openrouter/free";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function extractJsonArray(text: string): unknown[] | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const arr = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { path, name, desc = "", existing = [] } = await req.json();
    if (!path || !name || String(path).length > 500) {
      return json({ error: "path and name required" }, 400);
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: hit } = await db
      .from("drilldown_ai_expansions")
      .select("data")
      .eq("node_path", path)
      .maybeSingle();
    if (hit) return json({ children: hit.data, cached: true });

    const prompt =
      `You are expanding a node in a hierarchical topic-explorer treemap.\n` +
      `Full path of the node: ${path}\n` +
      `Node: "${name}"${desc ? ` - ${desc}` : ""}\n` +
      (existing.length
        ? `It already has these children (do NOT repeat them): ${existing.join(", ")}\n`
        : "") +
      `Generate 3 to 6 new sub-topics that break "${name}" down one level deeper, ` +
      `accurate and specific to its domain.\n` +
      `Respond with ONLY a JSON array, no prose, no markdown fences:\n` +
      `[{"name":"<max 40 chars>","desc":"<1-2 sentence explanation>"}]`;

    let children: unknown[] | null = null;
    let lastErr = "";
    for (let attempt = 0; attempt < 3 && !children; attempt++) {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OR_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 3000,
          temperature: 0.4,
        }),
      });
      const out = await r.json();
      if (!r.ok || out.error) {
        lastErr = out?.error?.message || `HTTP ${r.status}`;
        continue;
      }
      const content = out?.choices?.[0]?.message?.content ?? "";
      const arr = extractJsonArray(content);
      if (arr && arr.length) {
        children = arr
          .filter((c: any) => c && typeof c.name === "string")
          .slice(0, 6)
          .map((c: any) => ({
            name: String(c.name).slice(0, 60),
            desc: String(c.desc ?? "").slice(0, 400),
          }));
        if (!children.length) children = null;
      } else {
        lastErr = "model returned no parseable JSON";
      }
    }
    if (!children) return json({ error: `generation failed: ${lastErr}` }, 502);

    await db.from("drilldown_ai_expansions").upsert({
      node_path: path,
      data: children,
      model: MODEL,
    });
    return json({ children, cached: false });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
