import { pipeline, env, type ImageClassificationPipeline } from "@huggingface/transformers";

// Use the HF CDN for model weights, cache in IndexedDB on the user's device
env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL_ID = "onnx-community/Deep-Fake-Detector-v2-Model-ONNX";

let classifierPromise: Promise<ImageClassificationPipeline> | null = null;

export type LoadProgress = { status: string; progress?: number; file?: string };

export function loadDetector(onProgress?: (p: LoadProgress) => void) {
  if (!classifierPromise) {
    classifierPromise = pipeline("image-classification", MODEL_ID, {
      // Try WebGPU, fall back automatically to WASM
      device: "webgpu",
      dtype: "fp32",
      progress_callback: (data: any) => {
        onProgress?.({
          status: data.status,
          progress: typeof data.progress === "number" ? data.progress : undefined,
          file: data.file,
        });
      },
    }).catch(async (e) => {
      console.warn("WebGPU init failed, falling back to WASM", e);
      return pipeline("image-classification", MODEL_ID, {
        progress_callback: (data: any) => {
          onProgress?.({
            status: data.status,
            progress: typeof data.progress === "number" ? data.progress : undefined,
            file: data.file,
          });
        },
      });
    }) as Promise<ImageClassificationPipeline>;
  }
  return classifierPromise;
}

export type FrameScore = {
  fakeProbability: number; // 0..1
  realProbability: number; // 0..1
  raw: Array<{ label: string; score: number }>;
};

function isFakeLabel(label: string) {
  const l = label.toLowerCase();
  return l.includes("fake") || l.includes("deepfake") || l.includes("synthetic") || l === "ai" || l.includes("generated");
}

export async function classifyImage(imageSrc: string): Promise<FrameScore> {
  const classifier = await loadDetector();
  const output = (await classifier(imageSrc, { top_k: 5 })) as Array<{ label: string; score: number }>;
  let fake = 0;
  let real = 0;
  for (const r of output) {
    if (isFakeLabel(r.label)) fake += r.score;
    else real += r.score;
  }
  // Normalize in case model returned unnormalized scores
  const total = fake + real || 1;
  return { fakeProbability: fake / total, realProbability: real / total, raw: output };
}

export type AggregatedResult = {
  verdict: "authentic" | "likely_authentic" | "uncertain" | "likely_deepfake" | "deepfake";
  deepfake_probability: number; // 0..100
  confidence: number; // 0..100
  summary: string;
  observations: string[];
  perFrame?: FrameScore[];
};

export function aggregate(scores: FrameScore[]): AggregatedResult {
  const avgFake = scores.reduce((a, s) => a + s.fakeProbability, 0) / scores.length;
  const variance =
    scores.reduce((a, s) => a + (s.fakeProbability - avgFake) ** 2, 0) / scores.length;
  const stdev = Math.sqrt(variance);

  const pct = avgFake * 100;
  let verdict: AggregatedResult["verdict"];
  if (pct >= 85) verdict = "deepfake";
  else if (pct >= 60) verdict = "likely_deepfake";
  else if (pct >= 40) verdict = "uncertain";
  else if (pct >= 20) verdict = "likely_authentic";
  else verdict = "authentic";

  // Confidence: high when avg is near 0 or 100, and frames agree (low stdev)
  const decisiveness = Math.abs(avgFake - 0.5) * 2; // 0..1
  const agreement = scores.length > 1 ? Math.max(0, 1 - stdev * 2) : 1;
  const confidence = Math.round((decisiveness * 0.7 + agreement * 0.3) * 100);

  const summary =
    verdict === "deepfake" || verdict === "likely_deepfake"
      ? `Xception-class ONNX detector flagged synthetic-image patterns with ${pct.toFixed(0)}% probability.`
      : verdict === "uncertain"
      ? `Detector returned an inconclusive ${pct.toFixed(0)}% deepfake signal — features sit close to the decision boundary.`
      : `Detector found no strong synthetic-image artifacts (${pct.toFixed(0)}% deepfake probability).`;

  const observations: string[] = [
    `Model: onnx-community/Deep-Fake-Detector-v2 (in-browser ONNX, no server call)`,
    `Frames analyzed: ${scores.length}`,
    `Average fake probability: ${pct.toFixed(1)}%`,
  ];
  if (scores.length > 1) {
    const min = Math.min(...scores.map((s) => s.fakeProbability)) * 100;
    const max = Math.max(...scores.map((s) => s.fakeProbability)) * 100;
    observations.push(`Per-frame range: ${min.toFixed(1)}% – ${max.toFixed(1)}% (stdev ${(stdev * 100).toFixed(1)})`);
  }
  const top = scores[0]?.raw?.slice(0, 2).map((r) => `${r.label} ${(r.score * 100).toFixed(0)}%`).join(", ");
  if (top) observations.push(`Top labels (frame 1): ${top}`);

  return {
    verdict,
    deepfake_probability: Math.round(pct),
    confidence,
    summary,
    observations,
    perFrame: scores,
  };
}
