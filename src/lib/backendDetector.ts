import type { AnalysisResult } from "@/components/ResultCard";

export type BackendMediaType = "image" | "video";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8787";

export type BackendAnalysisResponse = AnalysisResult & {
  backend: string;
  model: string;
  mediaType: BackendMediaType;
  framesAnalyzed: number;
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function resolveVerdict(deepfakeProbability: number): AnalysisResult["verdict"] {
  if (deepfakeProbability >= 88) return "deepfake";
  if (deepfakeProbability >= 70) return "likely_deepfake";
  if (deepfakeProbability >= 50) return "uncertain";
  if (deepfakeProbability >= 30) return "likely_authentic";
  return "authentic";
}

function buildResult(
  mediaType: BackendMediaType,
  deepfakeProbability: number,
  confidence: number,
  framesAnalyzed: number,
  model = "faceforge-detector",
): BackendAnalysisResponse {
  const normalizedProbability = clampPercent(deepfakeProbability);
  const verdict = resolveVerdict(normalizedProbability);
  const resultConfidence = clampPercent(confidence);
  const realProbability = clampPercent(100 - normalizedProbability);
  const observations =
    mediaType === "video"
      ? [
          `Backend analyzed ${framesAnalyzed} sampled frame(s) from the uploaded video.`,
          normalizedProbability >= 50
            ? "The video contains a noticeable synthetic signal in the sampled frames."
            : "The sampled frames do not show a strong synthetic signal.",
        ]
      : [
          "Backend analyzed the dominant detected face in the uploaded image.",
          normalizedProbability >= 50
            ? "The face region contains visible deepfake artifacts."
            : "The face region appears consistent with authentic media.",
        ];

  const summary =
    verdict === "deepfake"
      ? "The uploaded media shows strong deepfake artifacts and is very likely synthetic."
      : verdict === "likely_deepfake"
        ? "The uploaded media is likely a deepfake, with a strong synthetic signal present."
        : verdict === "uncertain"
          ? "The uploaded media is inconclusive and sits near the model's decision boundary."
          : verdict === "likely_authentic"
            ? "The uploaded media appears authentic, but some artifacts are close to the detection threshold."
            : "The uploaded media appears authentic with no strong deepfake artifacts detected.";

  return {
    verdict,
    deepfake_probability: normalizedProbability,
    confidence: resultConfidence,
    summary,
    observations,
    ai_probability: normalizedProbability,
    real_probability: realProbability,
    backend: "python-fastapi-xception",
    model,
    mediaType,
    framesAnalyzed,
  };
}

function parseImageResponse(data: unknown): BackendAnalysisResponse {
  if (!data || typeof data !== "object") {
    throw new Error("Backend returned an invalid image response");
  }

  const payload = data as Record<string, unknown>;
  const prediction = payload.prediction === "FAKE" || payload.prediction === "REAL" ? payload.prediction : null;
  const confidence = typeof payload.confidence === "number" ? payload.confidence : NaN;
  const fakeProbability = typeof payload.fake_probability === "number" ? payload.fake_probability : NaN;
  const model = typeof payload.model === "string" ? payload.model : "faceforge-detector";

  if (!prediction || !Number.isFinite(confidence) || !Number.isFinite(fakeProbability)) {
    throw new Error("Backend returned an incomplete image response");
  }

  const deepfakeProbability = fakeProbability <= 1 ? fakeProbability * 100 : fakeProbability;
  return buildResult("image", deepfakeProbability, confidence, 1, model);
}

function parseVideoResponse(data: unknown): BackendAnalysisResponse {
  if (!data || typeof data !== "object") {
    throw new Error("Backend returned an invalid video response");
  }

  const payload = data as Record<string, unknown>;
  const prediction = payload.prediction === "FAKE" || payload.prediction === "REAL" ? payload.prediction : null;
  const confidence = typeof payload.confidence === "number" ? payload.confidence : NaN;
  const framesAnalyzed = typeof payload.frames_analyzed === "number" ? payload.frames_analyzed : NaN;
  const fakeFrames = typeof payload.fake_frames === "number" ? payload.fake_frames : NaN;
  const realFrames = typeof payload.real_frames === "number" ? payload.real_frames : NaN;
  const model = typeof payload.model === "string" ? payload.model : "faceforge-detector";

  if (
    !prediction ||
    !Number.isFinite(confidence) ||
    !Number.isFinite(framesAnalyzed) ||
    !Number.isFinite(fakeFrames) ||
    !Number.isFinite(realFrames)
  ) {
    throw new Error("Backend returned an incomplete video response");
  }

  const total = framesAnalyzed > 0 ? framesAnalyzed : fakeFrames + realFrames;
  const deepfakeProbability = total > 0 ? (fakeFrames / total) * 100 : prediction === "FAKE" ? 100 : 0;
  return buildResult("video", deepfakeProbability, confidence, framesAnalyzed, model);
}

export async function analyzeWithBackend(body: {
  file: File;
  mediaType: BackendMediaType;
}): Promise<BackendAnalysisResponse> {
  const endpoint = body.mediaType === "image" ? "/detect/image" : "/detect/video";
  const formData = new FormData();
  formData.append("file", body.file);

  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : typeof data?.error === "string"
          ? data.error
          : "Backend analysis failed",
    );
  }

  return body.mediaType === "image" ? parseImageResponse(data) : parseVideoResponse(data);
}
