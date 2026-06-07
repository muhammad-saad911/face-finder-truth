import { pipeline, env, type AudioClassificationPipeline } from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;

// Wav2Vec2 fine-tuned for bonafide vs spoof detection, ONNX-ready.
// Labels: 0 = real, 1 = fake
const MODEL_ID = "pranjal-pravesh/wav2vec2-large-xlsr-deepfake-audio-classification";
const TARGET_SR = 16000;

let audioClassifierPromise: Promise<AudioClassificationPipeline> | null = null;

export type AudioLoadProgress = { status: string; progress?: number; file?: string };

export function loadAudioDetector(onProgress?: (p: AudioLoadProgress) => void) {
  if (!audioClassifierPromise) {
    const opts: any = {
      dtype: "q8", // INT8 quantized to keep download small
      progress_callback: (data: any) => {
        onProgress?.({
          status: data.status,
          progress: typeof data.progress === "number" ? data.progress : undefined,
          file: data.file,
        });
      },
    };
    audioClassifierPromise = pipeline("audio-classification", MODEL_ID, opts)
      .catch((e) => {
        console.warn("Audio detector init failed:", e);
        audioClassifierPromise = null;
        throw e;
      }) as Promise<AudioClassificationPipeline>;
  }
  return audioClassifierPromise;
}

/** Extract mono 16kHz Float32 PCM from a video/audio File. Returns null if no audio track. */
export async function extractAudioPcm(file: File): Promise<Float32Array | null> {
  const arrayBuf = await file.arrayBuffer();
  const AudioCtx: typeof AudioContext =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  const tmpCtx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await tmpCtx.decodeAudioData(arrayBuf.slice(0));
  } catch (e) {
    await tmpCtx.close();
    return null; // no decodable audio
  }
  await tmpCtx.close();

  if (!decoded || decoded.length === 0) return null;

  // Downmix to mono
  const channels = decoded.numberOfChannels;
  const len = decoded.length;
  const mono = new Float32Array(len);
  for (let c = 0; c < channels; c++) {
    const data = decoded.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += data[i] / channels;
  }

  // Resample to 16kHz via OfflineAudioContext
  if (decoded.sampleRate === TARGET_SR) return mono;
  const offline = new OfflineAudioContext(
    1,
    Math.ceil((len / decoded.sampleRate) * TARGET_SR),
    TARGET_SR
  );
  const buf = offline.createBuffer(1, len, decoded.sampleRate);
  buf.copyToChannel(mono, 0);
  const src = offline.createBufferSource();
  src.buffer = buf;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice(0);
}

export type AudioVerdict = {
  fakeProbability: number; // 0..1
  realProbability: number;
  raw: Array<{ label: string; score: number }>;
};

function isFakeAudioLabel(label: string) {
  const l = label.toLowerCase();
  return (
    l === "fake" ||
    l === "spoof" ||
    l.includes("fake") ||
    l.includes("spoof") ||
    l.includes("synthetic") ||
    l === "label_1" ||
    l === "1"
  );
}

export async function classifyAudio(pcm: Float32Array): Promise<AudioVerdict> {
  const clf = await loadAudioDetector();
  // Cap to ~10s to keep inference snappy
  const maxSamples = TARGET_SR * 10;
  const slice = pcm.length > maxSamples ? pcm.slice(0, maxSamples) : pcm;
  const output = (await clf(slice, { top_k: 5 })) as Array<{ label: string; score: number }>;
  let fake = 0;
  let real = 0;
  for (const r of output) {
    if (isFakeAudioLabel(r.label)) fake += r.score;
    else real += r.score;
  }
  const total = fake + real || 1;
  return { fakeProbability: fake / total, realProbability: real / total, raw: output };
}
