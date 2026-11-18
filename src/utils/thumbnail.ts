import { shapePath } from "./shapes";
import { objectBounds } from "./bounds";
import { connectorShape } from "./connectors";
import type { BoardContent } from "../store";
import type { Theme } from "../types";

const COLORS = {
  light: { bg: "#faf8ff", ink: "#2a1f36" },
  dark: { bg: "#1b1524", ink: "#f3eaff" },
};
const ASPECT = 16 / 10;
const MAX_CHARS = 150_000; // keeps the preview small next to the board data

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// pasted images are shrunk to a tiny jpeg; cached so repeated saves stay fast
const imgCache = new Map<string, string | null>();
function shrinkImage(src: string): Promise<string | null> {
  if (imgCache.has(src)) return Promise.resolve(imgCache.get(src)!);
  return new Promise((resolve) => {
    const done = (v: string | null) => {
      imgCache.set(src, v);
      resolve(v);
    };
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 200 / Math.max(img.width, img.height, 1));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      const ctx = c.getContext("2d");
      if (!ctx) return done(null);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      done(c.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => done(null);
    img.src = src;
  });
}

function wrap(text: string, maxChars: number, maxLines: number) {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let cur = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = cur ? `${cur} ${word}` : word;
      if (next.length > maxChars && cur) {
        lines.push(cur);
        cur = word;
      } else cur = next;
    }
    lines.push(cur);
  }
  return lines.slice(0, maxLines);
}

const pts = (flat: number[]) => {
  const out: string[] = [];
  for (let i = 0; i < flat.length; i += 2) out.push(`${flat[i]},${flat[i + 1]}`);
  return out.join(" ");
};

// returns an SVG string, or "" for an empty board
export async function makeThumbnail(content: BoardContent, theme: Theme): Promise<string> {
  const t = COLORS[theme];
  const objs = Object.values(content.objects);
  if (objs.length === 0) return "";

  const conns = Object.values(content.connectors)
    .map((c) => ({ c, s: connectorShape(c, content.objects) }))
    .filter((x) => x.s !== null && x.s !== undefined);

  // find the area that holds everything
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const o of objs) {
    const b = objectBounds(o);
    minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
  }
  for (const { s } of conns) {
    const b = s!.bbox;
    minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
  }

  const pad = Math.max(maxX - minX, maxY - minY) * 0.08 + 10;
  let x = minX - pad, y = minY - pad;
  let w = maxX - minX + pad * 2, h = maxY - minY + pad * 2;
  if (w / h > ASPECT) {
    const nh = w / ASPECT;
    y -= (nh - h) / 2;
    h = nh;
  } else {
    const nw = h * ASPECT;
    x -= (nw - w) / 2;
    w = nw;
  }

  // shrink every image first
  const images = new Map<string, string | null>();
  await Promise.all(
    objs.map(async (o) => {
      const src = (o as unknown as { src?: string }).src;
      if (src) images.set(o.id, await shrinkImage(src));
    })
  );

  const render = (withImages: boolean, withText: boolean) => {
    const stroke = `stroke="${t.ink}" stroke-width="1.5" vector-effect="non-scaling-stroke"`;
    const parts: string[] = [];

    // images at the back, then shapes, connectors, text on top
    for (const o of objs) {
      const src = (o as unknown as { src?: string }).src;
      if (!src) continue;
      const small = withImages ? images.get(o.id) : null;
      const tf = `translate(${o.x} ${o.y}) rotate(${o.rotation})`;
      parts.push(
        small
          ? `<image href="${small}" width="${o.width}" height="${o.height}" transform="${tf}" preserveAspectRatio="none"/>`
          : `<rect width="${o.width}" height="${o.height}" transform="${tf}" fill="${t.ink}" fill-opacity="0.12"/>`
      );
    }

    for (const o of objs) {
      if (o.type !== "shape") continue;
      parts.push(
        `<path d="${shapePath(o.shape, o.width, o.height)}" transform="translate(${o.x} ${o.y}) rotate(${o.rotation})" fill="${esc(o.fill)}" ${stroke}/>`
      );
    }

    for (const { c, s } of conns) {
      const col = esc(c.color ?? t.ink);
      parts.push(`<path d="${s!.d}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"${c.dashed ? ' stroke-dasharray="6 4"' : ""}/>`);
      if (s!.startHead) parts.push(`<polygon points="${pts(s!.startHead)}" fill="${col}"/>`);
      if (s!.endHead) parts.push(`<polygon points="${pts(s!.endHead)}" fill="${col}"/>`);
    }

    if (withText) {
      for (const o of objs) {
        if (o.type !== "text" || !o.text.trim()) continue;
        const center = !!o.parentId;
        const lines = wrap(o.text, Math.max(1, Math.floor(o.width / (o.fontSize * 0.55))), 8);
        const tx = center ? o.width / 2 : 0;
        const tspans = lines
          .map((ln, i) => `<tspan x="${tx}" y="${o.fontSize * 0.85 + i * o.fontSize}">${esc(ln)}</tspan>`)
          .join("");
        parts.push(
          `<text transform="translate(${o.x} ${o.y}) rotate(${o.rotation})" font-size="${o.fontSize}" font-family="${esc(o.fontFamily)}" text-anchor="${center ? "middle" : "start"}" fill="${esc(o.color ?? t.ink)}">${tspans}</text>`
        );
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="320" height="200"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${t.bg}"/>${parts.join("")}</svg>`;
  };

  let svg = render(true, true);
  if (svg.length > MAX_CHARS) svg = render(false, true);
  if (svg.length > MAX_CHARS) svg = render(false, false);
  return svg.length > MAX_CHARS ? "" : svg;
}