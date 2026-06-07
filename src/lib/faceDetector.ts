// BlazeFace face detector — small (~1MB) TF.js model, runs fully in-browser.
import * as tf from "@tensorflow/tfjs";
import * as blazeface from "@tensorflow-models/blazeface";

let modelPromise: Promise<blazeface.BlazeFaceModel> | null = null;

export function loadFaceDetector() {
  if (!modelPromise) {
    modelPromise = (async () => {
      try {
        await tf.setBackend("webgl");
      } catch {
        await tf.setBackend("cpu");
      }
      await tf.ready();
      return blazeface.load();
    })();
  }
  return modelPromise;
}

/**
 * Returns a face-cropped JPEG data URL from an input image data URL.
 * Falls back to the original image when no face is detected.
 * Crop is padded by `pad` (fraction of face size) so context is preserved.
 */
export async function cropFace(
  imageDataUrl: string,
  pad = 0.4,
  outSize = 384,
): Promise<string> {
  const img = await loadImage(imageDataUrl);
  let model: blazeface.BlazeFaceModel;
  try {
    model = await loadFaceDetector();
  } catch (e) {
    console.warn("Face detector load failed, using full frame", e);
    return imageDataUrl;
  }

  const predictions = await model.estimateFaces(img, false);
  if (!predictions || predictions.length === 0) return imageDataUrl;

  // Pick largest face
  let best = predictions[0];
  let bestArea = 0;
  for (const p of predictions) {
    const [x1, y1] = p.topLeft as [number, number];
    const [x2, y2] = p.bottomRight as [number, number];
    const a = (x2 - x1) * (y2 - y1);
    if (a > bestArea) {
      bestArea = a;
      best = p;
    }
  }

  const [x1, y1] = best.topLeft as [number, number];
  const [x2, y2] = best.bottomRight as [number, number];
  const w = x2 - x1;
  const h = y2 - y1;
  const px = w * pad;
  const py = h * pad;
  const cx1 = Math.max(0, Math.floor(x1 - px));
  const cy1 = Math.max(0, Math.floor(y1 - py));
  const cx2 = Math.min(img.width, Math.ceil(x2 + px));
  const cy2 = Math.min(img.height, Math.ceil(y2 + py));
  const cw = cx2 - cx1;
  const ch = cy2 - cy1;

  const canvas = document.createElement("canvas");
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d")!;
  // Letterbox into square
  const scale = Math.min(outSize / cw, outSize / ch);
  const dw = Math.round(cw * scale);
  const dh = Math.round(ch * scale);
  const dx = Math.round((outSize - dw) / 2);
  const dy = Math.round((outSize - dh) / 2);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, outSize, outSize);
  ctx.drawImage(img, cx1, cy1, cw, ch, dx, dy, dw, dh);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
