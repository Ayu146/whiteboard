import { useBoard } from "../store";
import { screenToWorld } from "./coords";
import type { ImageObject } from "../types";

const MAX_SIDE = 1280; // longest side of the stored picture, in pixels
const MAX_CHARS = 300_000; // size limit per picture (keeps the board saveable)
const SHOW_MAX = 480; // longest side on the board when first added

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

// shrink until the picture is small enough to store inside the board
function encode(img: HTMLImageElement, keepAlpha: boolean): string {
  const nw = img.naturalWidth || 300;
  const nh = img.naturalHeight || 300;
  let side = MAX_SIDE;
  let quality = 0.85;
  let out = "";

  for (let i = 0; i < 8; i++) {
    const k = Math.min(1, side / Math.max(nw, nh));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(nw * k));
    c.height = Math.max(1, Math.round(nh * k));
    const ctx = c.getContext("2d");
    if (!ctx) break;
    if (!keepAlpha) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, c.width, c.height);
    }
    ctx.drawImage(img, 0, 0, c.width, c.height);
    out = c.toDataURL(keepAlpha ? "image/webp" : "image/jpeg", quality);
    if (out.length <= MAX_CHARS) break;
    side *= 0.8;
    quality = Math.max(0.55, quality - 0.07);
  }
  return out;
}

// Adds picture files to the board, centered on `center` (world coordinates),
// or on the middle of the screen when no point is given.
export async function addImageFiles(
  files: File[],
  center?: { x: number; y: number }
) {
  const images = files.filter((f) => f.type.startsWith("image/"));
  if (images.length === 0) return;

  const st = useBoard.getState();
  const c =
    center ??
    screenToWorld(window.innerWidth / 2, window.innerHeight / 2, st.viewport);

  const created: ImageObject[] = [];
  let failed = 0;

  for (const file of images) {
    try {
      const img = await loadImage(file);
      const keepAlpha = /png|webp|gif|svg/.test(file.type);
      const src = encode(img, keepAlpha);
      if (!src || src.length > MAX_CHARS * 1.5) {
        failed++;
        continue;
      }

      const nw = img.naturalWidth || 300;
      const nh = img.naturalHeight || 300;
      const k = Math.min(1, SHOW_MAX / Math.max(nw, nh));
      const width = Math.max(20, nw * k);
      const height = Math.max(20, nh * k);
      const offset = created.length * 24; // several files fan out a little

      created.push({
        id: crypto.randomUUID(),
        type: "image",
        src,
        x: c.x - width / 2 + offset,
        y: c.y - height / 2 + offset,
        width,
        height,
        rotation: 0,
      });
    } catch {
      failed++;
    }
  }

  if (created.length > 0) {
    const s = useBoard.getState();
    for (const o of created) s.addObject(o); // quick succession = one undo step
    s.select(created.map((o) => o.id));
    s.setTool("select");
  }
  if (failed > 0) {
    alert(
      failed === 1
        ? "One image couldn't be added (unreadable or too large)."
        : `${failed} images couldn't be added (unreadable or too large).`
    );
  }
}