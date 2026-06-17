/**
 * AI-powered background removal using @huggingface/transformers (RMBG-1.4).
 * Lazily loads the model on first use, caches in IndexedDB, and falls back
 * to a naive corner-color matcher if the model fails (CORS, no WebGPU, etc).
 */
import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;

let segmenterPromise: Promise<any> | null = null;
function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      try {
        return await pipeline("image-segmentation", "briaai/RMBG-1.4", {
          device: "webgpu" as any,
        });
      } catch {
        return await pipeline("image-segmentation", "briaai/RMBG-1.4");
      }
    })();
  }
  return segmenterPromise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

async function aiRemove(src: string): Promise<string> {
  const segmenter = await getSegmenter();
  const img = await loadImage(src);
  const result: any = await segmenter(src);
  const r = Array.isArray(result) ? result[0] : result;
  const mask = r?.mask;
  if (!mask?.data) throw new Error("no mask");

  const cv = document.createElement("canvas");
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, cv.width, cv.height);

  // Resize mask to image dimensions if needed (nearest-neighbour).
  const mw = mask.width ?? cv.width;
  const mh = mask.height ?? cv.height;
  const md = mask.data as Uint8Array;
  const px = id.data;
  if (mw === cv.width && mh === cv.height) {
    for (let i = 0; i < mw * mh; i++) px[i * 4 + 3] = md[i];
  } else {
    for (let y = 0; y < cv.height; y++) {
      const sy = Math.floor((y * mh) / cv.height);
      for (let x = 0; x < cv.width; x++) {
        const sx = Math.floor((x * mw) / cv.width);
        px[(y * cv.width + x) * 4 + 3] = md[sy * mw + sx];
      }
    }
  }
  ctx.putImageData(id, 0, 0);
  return cv.toDataURL("image/png");
}

function naiveRemove(src: string, tolerance = 38): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const cv = document.createElement("canvas");
        cv.width = img.naturalWidth;
        cv.height = img.naturalHeight;
        const ctx = cv.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const id = ctx.getImageData(0, 0, cv.width, cv.height);
        const d = id.data;
        const at = (x: number, y: number) => {
          const i = (y * cv.width + x) * 4;
          return [d[i], d[i + 1], d[i + 2]] as const;
        };
        const corners = [
          at(0, 0),
          at(cv.width - 1, 0),
          at(0, cv.height - 1),
          at(cv.width - 1, cv.height - 1),
        ];
        const avg = [0, 1, 2].map(
          (c) => corners.reduce((s, p) => s + p[c], 0) / corners.length,
        );
        const t2 = tolerance * tolerance;
        for (let i = 0; i < d.length; i += 4) {
          const dr = d[i] - avg[0];
          const dg = d[i + 1] - avg[1];
          const db = d[i + 2] - avg[2];
          if (dr * dr + dg * dg + db * db < t2) d[i + 3] = 0;
        }
        ctx.putImageData(id, 0, 0);
        resolve(cv.toDataURL("image/png"));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

export async function removeBackground(src: string): Promise<string> {
  try {
    return await aiRemove(src);
  } catch (e) {
    console.warn("[bg-remove] AI path failed, using fallback:", e);
    return naiveRemove(src);
  }
}
