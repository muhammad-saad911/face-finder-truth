import type { AnalysisResult } from "@/components/ResultCard";
import { authHeaders, backendUrl, getStoredAuth } from "@/lib/backendSession";

export type SavedAnalysis = {
  id: string;
  user_id: string;
  file_name: string;
  media_type: "image" | "video";
  verdict: AnalysisResult["verdict"];
  deepfake_probability: number;
  confidence: number;
  ai_probability: number | null;
  real_probability: number | null;
  summary: string;
  observations: string[];
  backend: string;
  model: string;
  frame_count: number;
  created_at: string;
};

const LOCAL_HISTORY_PREFIX = "face-finder-history";

function localHistoryKey(userId: string) {
  return `${LOCAL_HISTORY_PREFIX}:${userId}`;
}

function currentUserId() {
  return getStoredAuth()?.user?.id ?? "guest";
}

function readLocalAnalyses(userId: string): SavedAnalysis[] {
  try {
    const raw = localStorage.getItem(localHistoryKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedAnalysis[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalAnalyses(userId: string, items: SavedAnalysis[]) {
  localStorage.setItem(localHistoryKey(userId), JSON.stringify(items.slice(0, 50)));
}

export async function loadUserAnalyses(limit = 10): Promise<SavedAnalysis[]> {
  const userId = currentUserId();
  try {
    const response = await fetch(`${backendUrl()}/analyses?limit=${limit}`, {
      headers: authHeaders(),
    });
    const data = (await response.json().catch(() => ({}))) as { detail?: string; error?: string } | SavedAnalysis[];
    if (!response.ok) {
      throw new Error((data as { detail?: string; error?: string }).detail || (data as { detail?: string; error?: string }).error || "Failed to load analyses");
    }
    if (Array.isArray(data)) {
      return data;
    }
  } catch (error) {
    console.warn("Falling back to local scan history:", error);
  }

  return readLocalAnalyses(userId).slice(0, limit);
}

export async function saveAnalysisForUser(params: {
  fileName: string;
  mediaType: "image" | "video";
  frameCount: number;
  result: AnalysisResult & {
    backend?: string;
    model?: string;
    ai_probability?: number;
    real_probability?: number;
  };
  }) {
  const userId = currentUserId();
  const payload = {
    file_name: params.fileName,
    media_type: params.mediaType,
    frame_count: params.frameCount,
    verdict: params.result.verdict,
    deepfake_probability: params.result.deepfake_probability,
    confidence: params.result.confidence,
    ai_probability: typeof params.result.ai_probability === "number" ? params.result.ai_probability : null,
    real_probability: typeof params.result.real_probability === "number" ? params.result.real_probability : null,
    summary: params.result.summary,
    observations: params.result.observations,
    backend: params.result.backend ?? "python-fastapi-xception",
    model: params.result.model ?? "detector_best.pth",
  };

  try {
    const response = await fetch(`${backendUrl()}/analyses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => ({}))) as { detail?: string; error?: string } | SavedAnalysis;
    if (!response.ok) {
      throw new Error((data as { detail?: string; error?: string }).detail || (data as { detail?: string; error?: string }).error || "Failed to save analysis");
    }
    return data as SavedAnalysis;
  } catch (error) {
    console.warn("Falling back to local scan history save:", error);
    const existing = readLocalAnalyses(userId);
    const local: SavedAnalysis = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      user_id: userId,
      file_name: params.fileName,
      media_type: params.mediaType,
      verdict: params.result.verdict,
      deepfake_probability: params.result.deepfake_probability,
      confidence: params.result.confidence,
      ai_probability: typeof params.result.ai_probability === "number" ? params.result.ai_probability : null,
      real_probability: typeof params.result.real_probability === "number" ? params.result.real_probability : null,
      summary: params.result.summary,
      observations: params.result.observations,
      backend: payload.backend,
      model: payload.model,
      frame_count: params.frameCount,
      created_at: new Date().toISOString(),
    };
    writeLocalAnalyses(userId, [local, ...existing]);
    return local;
  }
}
