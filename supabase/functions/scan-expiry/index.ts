// Read an expiry date from an image using Lovable AI vision
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) throw new Error("imageBase64 required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const currentYear = today.getUTCFullYear();

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  `Today's date is ${todayIso}. Find the expiry / use-by / best-before date printed on this food packaging. ` +
                  `Return ISO format YYYY-MM-DD. ` +
                  `IMPORTANT date rules: ` +
                  `1) Most food expiry dates are within the next 0-24 months from today. ` +
                  `2) Two-digit years like "25", "26", "27" mean 20XX (e.g. "25" = 2025), NEVER 21XX or 19XX. ` +
                  `3) Non-US packaging usually uses DD/MM/YYYY (day first). US packaging often uses MM/DD/YYYY. Pick the format that yields a plausible near-future date. ` +
                  `4) The resulting year MUST be between ${currentYear} and ${currentYear + 5}. If parsing gives a year outside that range, you misread it — re-examine. ` +
                  `5) Also report the rawText exactly as printed so we can verify. ` +
                  `Return the result via the tool.`,
              },
              { type: "image_url", image_url: { url: imageBase64 } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_date",
              description: "Return the detected expiry date",
              parameters: {
                type: "object",
                properties: {
                  date: {
                    type: "string",
                    description: "ISO date YYYY-MM-DD, or empty string if not found",
                  },
                  rawText: { type: "string", description: "Raw text seen on the package" },
                  confidence: { type: "string", enum: ["high", "medium", "low"] },
                },
                required: ["date", "rawText", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_date" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429)
        return new Response(JSON.stringify({ error: "Rate limit hit." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (response.status === 402)
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      const t = await response.text();
      console.error("AI error", response.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : { date: "", rawText: "", confidence: "low" };

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
