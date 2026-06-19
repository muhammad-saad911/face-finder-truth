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
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, cx1, cy1, cw, ch, dx, dy, dw, dh);
  return canvas.toDataURL("image/png");
}

/**
 * Returns ALL detected faces as cropped data URLs (largest first).
 * Useful for still images where multiple subjects may appear.
 * Returns [originalImage] when no faces are detected.
 */
export async function cropAllFaces(
  imageDataUrl: string,
  pad = 0.4,
  outSize = 384,
  maxFaces = 4,
): Promise<string[]> {
  const img = await loadImage(imageDataUrl);
  let model: blazeface.BlazeFaceModel;
  try {
    model = await loadFaceDetector();
  } catch {
    return [imageDataUrl];
  }
  const predictions = await model.estimateFaces(img, false);
  if (!predictions || predictions.length === 0) return [imageDataUrl];

  const sorted = [...predictions].sort((a, b) => {
    const [ax1, ay1] = a.topLeft as [number, number];
    const [ax2, ay2] = a.bottomRight as [number, number];
    const [bx1, by1] = b.topLeft as [number, number];
    const [bx2, by2] = b.bottomRight as [number, number];
    return (bx2 - bx1) * (by2 - by1) - (ax2 - ax1) * (ay2 - ay1);
  });

  const crops: string[] = [];
  for (const p of sorted.slice(0, maxFaces)) {
    const [x1, y1] = p.topLeft as [number, number];
    const [x2, y2] = p.bottomRight as [number, number];
    const w = x2 - x1;
    const h = y2 - y1;
    if (w < 24 || h < 24) continue; // skip tiny detections
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
    const scale = Math.min(outSize / cw, outSize / ch);
    const dw = Math.round(cw * scale);
    const dh = Math.round(ch * scale);
    const dx = Math.round((outSize - dw) / 2);
    const dy = Math.round((outSize - dh) / 2);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, outSize, outSize);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, cx1, cy1, cw, ch, dx, dy, dw, dh);
    crops.push(canvas.toDataURL("image/png"));
  }
  return crops.length ? crops : [imageDataUrl];
}

/**
 * Multi-scale crops for every detected face.
 * For each face, emits crops at multiple padding levels (tight, medium, wide)
 * so the detector sees both fine skin/eye detail AND surrounding context.
 * This helps catch partial manipulations (e.g. swapped eyes/mouth only).
 *
 * Also adds a center sliding-window crop of the whole image as a fallback
 * for non-face manipulations and when no face is detected.
 */
export async function cropFacesMultiScale(
  imageDataUrl: string,
  pads: number[] = [0.15, 0.4, 0.8],
  outSize = 384,
  maxFaces = 3,
): Promise<string[]> {
  const img = await loadImage(imageDataUrl);
  const out: string[] = [];

  let predictions: blazeface.NormalizedFace[] = [];
  try {
    const model = await loadFaceDetector();
    predictions = (await model.estimateFaces(img, false)) ?? [];
  } catch {
    /* fall through to whole-image tiles */
  }

  const sorted = [...predictions].sort((a, b) => {
    const [ax1, ay1] = a.topLeft as [number, number];
    const [ax2, ay2] = a.bottomRight as [number, number];
    const [bx1, by1] = b.topLeft as [number, number];
    const [bx2, by2] = b.bottomRight as [number, number];
    return (bx2 - bx1) * (by2 - by1) - (ax2 - ax1) * (ay2 - ay1);
  });

  for (const p of sorted.slice(0, maxFaces)) {
    const [x1, y1] = p.topLeft as [number, number];
    const [x2, y2] = p.bottomRight as [number, number];
    const w = x2 - x1;
    const h = y2 - y1;
    if (w < 24 || h < 24) continue;
    for (const pad of pads) {
      const px = w * pad;
      const py = h * pad;
      const cx1 = Math.max(0, Math.floor(x1 - px));
      const cy1 = Math.max(0, Math.floor(y1 - py));
      const cx2 = Math.min(img.width, Math.ceil(x2 + px));
      const cy2 = Math.min(img.height, Math.ceil(y2 + py));
      out.push(letterbox(img, cx1, cy1, cx2 - cx1, cy2 - cy1, outSize));
    }
  }

  // Sliding-window tiles over the full image (catches non-face edits / no face).
  const tiles = sortedTiles(img.width, img.height);
  // If no faces, take 3 tiles (center + 2 halves). If faces, just add center tile.
  const tileCount = predictions.length === 0 ? Math.min(3, tiles.length) : 1;
  for (let i = 0; i < tileCount; i++) {
    const [tx, ty, tw, th] = tiles[i];
    out.push(letterbox(img, tx, ty, tw, th, outSize));
  }

  return out.length ? out : [imageDataUrl];
}

function letterbox(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  outSize: number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.min(outSize / sw, outSize / sh);
  const dw = Math.round(sw * scale);
  const dh = Math.round(sh * scale);
  const dx = Math.round((outSize - dw) / 2);
  const dy = Math.round((outSize - dh) / 2);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, outSize, outSize);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  return canvas.toDataURL("image/png");
}

/** Center square + left/right (or top/bottom) halves as sliding tiles. */
function sortedTiles(W: number, H: number): Array<[number, number, number, number]> {
  const s = Math.min(W, H);
  const cx = Math.floor((W - s) / 2);
  const cy = Math.floor((H - s) / 2);
  const tiles: Array<[number, number, number, number]> = [[cx, cy, s, s]];
  if (W >= H) {
    tiles.push([0, 0, s, H]);
    tiles.push([W - s, 0, s, H]);
  } else {
    tiles.push([0, 0, W, s]);
    tiles.push([0, H - s, W, s]);
  }
  return tiles;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
