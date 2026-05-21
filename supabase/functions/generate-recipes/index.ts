// Generate recipes from a list of expiring food items using Lovable AI
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_LIMIT = 10;
const FUNCTION_NAME = "generate-recipes";

function getIdentifier(req: Request): string {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    if (payload?.sub && payload?.role !== "anon") return `user:${payload.sub}`;
  } catch {}
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
  return `ip:${ip}`;
}

async function checkRateLimit(identifier: string): Promise<{ allowed: boolean; count: number }> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_api_usage`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_identifier: identifier,
      p_function_name: FUNCTION_NAME,
      p_limit: DAILY_LIMIT,
    }),
  });
  if (!res.ok) {
    console.error("rate limit rpc failed", res.status, await res.text());
    return { allowed: true, count: 0 }; // fail open
  }
  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] : rows;
  return { allowed: !!row?.allowed, count: row?.current_count ?? 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Auth enforced by Supabase (verify_jwt=true). Defense in depth:
    const auth = req.headers.get("Authorization") || "";
    if (!/^Bearer\s+/i.test(auth)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const identifier = getIdentifier(req);
    const limit = await checkRateLimit(identifier);
    if (!limit.allowed) {
      return new Response(
        JSON.stringify({ error: "Daily limit reached — come back tomorrow." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { items, staples } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const itemList = (items || [])
      .map((i: any) => `- ${i.name} (${i.category}${i.daysLeft != null ? `, expires in ${i.daysLeft} day(s)` : ""})`)
      .join("\n");

    const staplesList = (staples || [])
      .map((s: any) => `- ${s.name} (${s.category})`)
      .join("\n");

    const systemPrompt = `You are Shelfy, a warm and friendly home cook who helps people use up food before it goes to waste. Suggest practical recipes using ingredients people already have. Be encouraging and never preachy.`;

    const staplesBlock = staplesList
      ? `\n\nThe user also has these pantry staples always available — feel free to use them, but don't build recipes around them:\n${staplesList}`
      : "";

    const userPrompt = `Suggest 4 recipes that use these ingredients expiring soon. Prioritise the items expiring earliest. Recipes should feel approachable, not fancy.

Ingredients expiring soon:
${itemList}${staplesBlock}

For each recipe, pick ONE emoji that visually matches the specific dish. Examples: pasta dishes → 🍝, stir-fry → 🥘, soup → 🍲, salad → 🥗, omelette/eggs → 🍳, sandwich → 🥪, taco → 🌮, burger → 🍔, pizza → 🍕, curry → 🍛, sushi → 🍣, ramen/noodles → 🍜, rice bowl → 🍚, roast meat → 🍗, fish → 🐟, smoothie → 🥤, pancakes → 🥞, baked goods → 🥐, dessert → 🍰. NEVER use the generic plate emoji 🍽️ — always pick something that represents the actual dish.`;


    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_recipes",
              description: "Return recipe suggestions",
              parameters: {
                type: "object",
                properties: {
                  recipes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Recipe name" },
                        emoji: { type: "string", description: "A single food emoji that visually matches THIS specific dish (e.g. 🍝 pasta, 🥗 salad, 🍳 eggs, 🍲 soup, 🥪 sandwich, 🍛 curry, 🍜 noodles, 🥞 pancakes, 🍰 dessert). Never use 🍽️." },
                        usesItems: {
                          type: "array",
                          items: { type: "string" },
                          description: "Names of expiring items used",
                        },
                        cookTime: { type: "string", description: "e.g. '20 mins'" },
                        difficulty: { type: "string", enum: ["Easy", "Medium", "Hard"] },
                        description: { type: "string", description: "1 short sentence" },
                        ingredients: { type: "array", items: { type: "string" } },
                        steps: { type: "array", items: { type: "string" } },
                      },
                      required: ["name", "emoji", "usesItems", "cookTime", "difficulty", "description", "ingredients", "steps"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["recipes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_recipes" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit hit, try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : { recipes: [] };

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
