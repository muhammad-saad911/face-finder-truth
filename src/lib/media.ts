export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Resize/compress an image data URL to keep payload small
export async function compressImage(dataUrl: string, maxDim = 1024, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export async function extractVideoFrames(file: File, frameCount = 5, maxDim = 1024): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    const url = URL.createObjectURL(file);
    video.src = url;

    const frames: string[] = [];
    let timestamps: number[] = [];
    let idx = 0;

    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadedmetadata = () => {
      const duration = video.duration || 1;
      // Sample evenly, skipping very start and end
      timestamps = Array.from({ length: frameCount }, (_, i) =>
        ((i + 1) / (frameCount + 1)) * duration
      );
      video.currentTime = timestamps[0];
    };

    video.onseeked = () => {
      const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0, w, h);
      frames.push(canvas.toDataURL("image/jpeg", 0.82));
      idx++;
      if (idx < timestamps.length) {
        video.currentTime = timestamps[idx];
      } else {
        cleanup();
        resolve(frames);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to read video file"));
    };
  });
}
