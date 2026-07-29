const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 6_000_000;

const SYSTEM_PROMPT = `You are a forensic deepfake analyst. Inspect the provided image(s) or video frames for signs of synthetic generation, face swapping, or manipulation.

Look for:
- Unnatural skin texture, smoothing, or waxy appearance
- Inconsistent lighting, reflections, or shadows
- Warped facial geometry or asymmetry
- Edge artifacts around hair, jawline, teeth, ears, or glasses
- Inconsistent eye direction, blinking, or pupil shape
- Background warping and compression artifacts that do not match the scene
- AI generation cues such as over-smooth detail, repeating texture, or impossible geometry

Return only a concise, evidence-based assessment. If the media is ambiguous, prefer a cautious verdict.`;

type Verdict = "authentic" | "likely_authentic" | "uncertain" | "likely_deepfake" | "deepfake";

type AnalysisResult = {
  verdict: Verdict;
  deepfake_probability: number;
  confidence: number;
  summary: string;
  observations: string[];
};

type AnalysisPayload = {
  images?: unknown;
  mediaType?: unknown;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isVerdict(value: unknown): value is Verdict {
  return (
    value === "authentic" ||
    value === "likely_authentic" ||
    value === "uncertain" ||
    value === "likely_deepfake" ||
    value === "deepfake"
  );
}

function normalizeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function validateImages(images: unknown): string[] {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("No images provided");
  }
  if (images.length > MAX_IMAGES) {
    throw new Error(`Too many frames (max ${MAX_IMAGES})`);
  }

  const cleaned = images.map((image, index) => {
    if (typeof image !== "string" || !image.trim()) {
      throw new Error(`Invalid image at index ${index}`);
    }
    if (image.length > MAX_IMAGE_BYTES) {
      throw new Error(`Image ${index + 1} is too large`);
    }
    return image;
  });

  return cleaned;
}

function buildUserMessage(images: string[], mediaType: string) {
  const intro =
    mediaType === "video"
      ? `Analyze these ${images.length} frames sampled from a video. Assess temporal consistency and the likelihood of synthetic manipulation.`
      : "Analyze this image for deepfake or AI-generated manipulation.";

  return [
    {
      type: "text",
      text: `${intro} Provide a verdict, deepfake probability (0-100), confidence (0-100), a one-sentence summary, and 3-6 short observations.`,
    },
    ...images.map((img) => ({
      type: "image_url",
      image_url: { url: img },
    })),
  ];
}

function parseResult(data: unknown): AnalysisResult {
  if (!data || typeof data !== "object") {
    throw new Error("Model returned an invalid payload");
  }

  const raw = data as Record<string, unknown>;
  const verdict = raw.verdict;
  if (!isVerdict(verdict)) {
    throw new Error("Model returned an invalid verdict");
  }

  const observations = Array.isArray(raw.observations)
    ? raw.observations.filter((item): item is string => typeof item === "string" && item.trim()).slice(0, 8)
    : [];

  return {
    verdict,
    deepfake_probability: clamp(toNumber(raw.deepfake_probability, 0), 0, 100),
    confidence: clamp(toNumber(raw.confidence, 0), 0, 100),
    summary: normalizeText(raw.summary, "Analysis completed, but the model did not provide a summary."),
    observations: observations.length
      ? observations
      : ["Model did not return any observations."],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return json({
      ok: true,
      service: "detect-deepfake",
      version: "1.0.0",
      maxImages: MAX_IMAGES,
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json()) as AnalysisPayload;
    const images = validateImages(body.images);
    const mediaType = body.mediaType === "video" ? "video" : "image";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

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
          { role: "user", content: buildUserMessage(images, mediaType) },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_analysis",
              description: "Return the deepfake analysis result",
              parameters: {
                type: "object",
                properties: {
                  verdict: {
                    type: "string",
                    enum: ["authentic", "likely_authentic", "uncertain", "likely_deepfake", "deepfake"],
                  },
                  deepfake_probability: {
                    type: "number",
                    minimum: 0,
                    maximum: 100,
                  },
                  confidence: {
                    type: "number",
                    minimum: 0,
                    maximum: 100,
                  },
                  summary: {
                    type: "string",
                  },
                  observations: {
                    type: "array",
                    items: { type: "string" },
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
        return json({ error: "Rate limit exceeded. Try again shortly." }, 429);
      }
      if (response.status === 402) {
        return json({ error: "AI credits exhausted. Add credits in the workspace settings." }, 402);
      }

      const errorText = await response.text();
      console.error("AI gateway error", response.status, errorText);
      return json({ error: "AI gateway error" }, 500);
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call returned", JSON.stringify(data));
      return json({ error: "Model did not return analysis" }, 500);
    }

    const parsed = parseResult(JSON.parse(toolCall.function.arguments));
    return json({
      ...parsed,
      backend: "supabase-edge",
      mediaType,
      framesAnalyzed: images.length,
    });
  } catch (error) {
    console.error("detect-deepfake error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
