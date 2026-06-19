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

/**
 * Test-Time Augmentation: classifies the image, a horizontal flip, and a
 * center-zoom (90%) crop, then averages the probabilities. Costs ~3x compute
 * but typically improves accuracy by 2-5% and reduces false positives on
 * borderline images. Use this for single-image analysis (not video frames).
 */
export async function classifyImageTTA(imageSrc: string): Promise<FrameScore> {
  const variants = await Promise.all([
    Promise.resolve(imageSrc),
    transformImage(imageSrc, "flip"),
    transformImage(imageSrc, "zoom"),
  ]);
  const results = await Promise.all(variants.map((v) => classifyImage(v)));
  const fake = results.reduce((a, r) => a + r.fakeProbability, 0) / results.length;
  const real = results.reduce((a, r) => a + r.realProbability, 0) / results.length;
  // Merge raw labels: sum scores per label, then re-normalize
  const merged = new Map<string, number>();
  for (const r of results) {
    for (const e of r.raw) merged.set(e.label, (merged.get(e.label) ?? 0) + e.score / results.length);
  }
  const raw = Array.from(merged.entries())
    .map(([label, score]) => ({ label, score }))
    .sort((a, b) => b.score - a.score);
  return { fakeProbability: fake, realProbability: real, raw };
}

async function transformImage(src: string, mode: "flip" | "zoom"): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  if (mode === "flip") {
    ctx.translate(img.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
  } else {
    // center-zoom: take the inner 90% region and stretch back to full size
    const cw = img.width * 0.9;
    const ch = img.height * 0.9;
    const sx = (img.width - cw) / 2;
    const sy = (img.height - ch) / 2;
    ctx.drawImage(img, sx, sy, cw, ch, 0, 0, img.width, img.height);
  }
  return canvas.toDataURL("image/png");
}

export type AggregatedResult = {
  verdict: "authentic" | "likely_authentic" | "uncertain" | "likely_deepfake" | "deepfake";
  deepfake_probability: number; // 0..100
  confidence: number; // 0..100
  summary: string;
  observations: string[];
  perFrame?: FrameScore[];
};

export type AudioFusion = {
  fakeProbability: number; // 0..1
  raw: Array<{ label: string; score: number }>;
};

/**
 * Aggregates per-crop / per-frame scores.
 * `mode = "topk"` (default for stills) keeps the top-K most-fake crops and
 * averages them — deepfake artifacts are LOCAL, so a strong signal in one
 * face/region must not be diluted by neutral context tiles.
 * `mode = "mean"` is for videos where every frame should agree.
 */
export function aggregate(
  scores: FrameScore[],
  audio?: AudioFusion | null,
  mode: "mean" | "topk" = "mean",
): AggregatedResult {
  const sorted = [...scores].sort((a, b) => b.fakeProbability - a.fakeProbability);
  const k = mode === "topk" ? Math.max(1, Math.ceil(scores.length / 3)) : scores.length;
  const pooled = sorted.slice(0, k);
  const avgFake = pooled.reduce((a, s) => a + s.fakeProbability, 0) / pooled.length;
  const variance =
    scores.reduce((a, s) => a + (s.fakeProbability - avgFake) ** 2, 0) / scores.length;
  const stdev = Math.sqrt(variance);
  const maxFake = sorted[0]?.fakeProbability ?? 0;

  // Fuse visual + audio: weighted average (visual 0.65, audio 0.35).
  const fused = audio
    ? avgFake * 0.65 + audio.fakeProbability * 0.35
    : avgFake;


  const pct = fused * 100;
  let verdict: AggregatedResult["verdict"];
  if (pct >= 85) verdict = "deepfake";
  else if (pct >= 60) verdict = "likely_deepfake";
  else if (pct >= 40) verdict = "uncertain";
  else if (pct >= 20) verdict = "likely_authentic";
  else verdict = "authentic";

  const decisiveness = Math.abs(fused - 0.5) * 2;
  const agreement = scores.length > 1 ? Math.max(0, 1 - stdev * 2) : 1;
  // Audio that agrees with visual boosts confidence; disagreement lowers it.
  const av = audio ? 1 - Math.abs(avgFake - audio.fakeProbability) : 1;
  const confidence = Math.round((decisiveness * 0.6 + agreement * 0.25 + av * 0.15) * 100);

  const visualPct = avgFake * 100;
  const audioPct = audio ? audio.fakeProbability * 100 : null;

  const summary =
    verdict === "deepfake" || verdict === "likely_deepfake"
      ? audio
        ? `Visual + audio detectors flagged synthetic patterns (fused ${pct.toFixed(0)}%, visual ${visualPct.toFixed(0)}%, audio ${audioPct!.toFixed(0)}%).`
        : `Xception-class ONNX detector flagged synthetic-image patterns with ${pct.toFixed(0)}% probability.`
      : verdict === "uncertain"
      ? `Detector returned an inconclusive ${pct.toFixed(0)}% deepfake signal — features sit close to the decision boundary.`
      : audio
      ? `No strong synthetic artifacts in video frames or audio (fused ${pct.toFixed(0)}%).`
      : `Detector found no strong synthetic-image artifacts (${pct.toFixed(0)}% deepfake probability).`;

  const observations: string[] = [
    `Visual model: onnx-community/Deep-Fake-Detector-v2 (in-browser ONNX)`,
    `Frames analyzed: ${scores.length}`,
    `Visual fake probability: ${visualPct.toFixed(1)}%`,
  ];
  if (scores.length > 1) {
    const min = Math.min(...scores.map((s) => s.fakeProbability)) * 100;
    const max = Math.max(...scores.map((s) => s.fakeProbability)) * 100;
    observations.push(`Per-frame range: ${min.toFixed(1)}% – ${max.toFixed(1)}% (stdev ${(stdev * 100).toFixed(1)})`);
  }
  if (audio && audioPct !== null) {
    observations.push(`Audio model: wav2vec2-xlsr deepfake (in-browser ONNX, INT8)`);
    observations.push(`Audio fake probability: ${audioPct.toFixed(1)}%`);
    const topA = audio.raw.slice(0, 2).map((r) => `${r.label} ${(r.score * 100).toFixed(0)}%`).join(", ");
    if (topA) observations.push(`Top audio labels: ${topA}`);
  }
  const top = scores[0]?.raw?.slice(0, 2).map((r) => `${r.label} ${(r.score * 100).toFixed(0)}%`).join(", ");
  if (top) observations.push(`Top visual labels (frame 1): ${top}`);

  return {
    verdict,
    deepfake_probability: Math.round(pct),
    confidence,
    summary,
    observations,
    perFrame: scores,
  };
}
