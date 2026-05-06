const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an expert deepfake and synthetic media detection system. Analyze the provided image(s) for signs of AI generation, face manipulation, or deepfake artifacts.

Look for:
- Unnatural skin texture, smoothing, or waxy appearance
- Inconsistent lighting, shadows, or reflections (especially in eyes)
- Asymmetric or warped facial features
- Blurry or mismatched edges around face/hair
- Unnatural eye blinking, gaze, or pupil shapes
- Teeth that look fused or irregular
- Background warping or inconsistencies
- Compression artifacts inconsistent with the rest of the image
- Telltale signs of GAN/diffusion generation

If multiple frames are provided, they are sampled from a video — assess temporal consistency.

You MUST call the report_analysis function with your verdict.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { images, mediaType } = await req.json();
    if (!Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "No images provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (images.length > 8) {
      return new Response(JSON.stringify({ error: "Too many frames (max 8)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userContent: any[] = [
      {
        type: "text",
        text: `Analyze ${mediaType === "video" ? `these ${images.length} frames sampled from a video` : "this image"} for deepfake / AI manipulation. Provide a verdict, confidence percentage (0-100, how confident you are in your verdict), and key observations.`,
      },
      ...images.map((img: string) => ({
        type: "image_url",
        image_url: { url: img },
      })),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_analysis",
              description: "Report deepfake detection analysis",
              parameters: {
                type: "object",
                properties: {
                  verdict: {
                    type: "string",
                    enum: ["authentic", "likely_authentic", "uncertain", "likely_deepfake", "deepfake"],
                    description: "Overall verdict",
                  },
                  deepfake_probability: {
                    type: "number",
                    description: "Probability (0-100) that the media is a deepfake or AI-manipulated",
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence in the verdict (0-100)",
                  },
                  summary: {
                    type: "string",
                    description: "One-sentence plain-English summary",
                  },
                  observations: {
                    type: "array",
                    items: { type: "string" },
                    description: "Key visual cues observed (3-6 bullet points)",
                  },
                },
                required: ["verdict", "deepfake_probability", "confidence", "summary", "observations"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Lovable workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call returned", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "Model did not return analysis" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-deepfake error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
