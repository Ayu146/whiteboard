import Konva from "konva";
import type { ShapeKind, ShapeObject, TextObject } from "../types";

export const FONTS = [
  { label: "Sans", value: "Arial, Helvetica, sans-serif" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Mono", value: "'Courier New', monospace" },
  { label: "Rounded", value: "'Trebuchet MS', sans-serif" },
  { label: "Hand", value: "'Comic Sans MS', cursive" },
  { label: "Display", value: "Impact, sans-serif" },
];

export const DEFAULT_FONT = FONTS[0].value;

export function measureHeight(
  text: string,
  fontSize: number,
  fontFamily: string,
  width: number
) {
  const node = new Konva.Text({
    text: text === "" ? " " : text,
    fontSize,
    fontFamily,
    width,
  });
  const h = node.height();
  node.destroy();
  return h;
}

// width of the longest line when the text is not wrapped
export function measureWidth(text: string, fontSize: number, fontFamily: string) {
  const node = new Konva.Text({ text: text === "" ? " " : text, fontSize, fontFamily });
  const w = node.width();
  node.destroy();
  return w;
}

// how much of the shape is usable for text (fractions of width/height),
// and dy = vertical shift of the text center (fraction of height, + is down)
type Inset = { w: number; h: number; dy: number };
const DEFAULT_INSET: Inset = { w: 0.8, h: 0.8, dy: 0 };
const INSET: Partial<Record<ShapeKind, Inset>> = {
  rounded: { w: 0.8, h: 0.8, dy: 0 },
  circle: { w: 0.7, h: 0.7, dy: 0 },
  diamond: { w: 0.5, h: 0.5, dy: 0 },
  triangle: { w: 0.5, h: 0.4, dy: 0.2 },
  invTriangle: { w: 0.5, h: 0.4, dy: -0.2 },
  parallelogramR: { w: 0.6, h: 0.75, dy: 0 },
  parallelogramL: { w: 0.6, h: 0.75, dy: 0 },
  trapezoid: { w: 0.6, h: 0.75, dy: 0 },
  pentagon: { w: 0.62, h: 0.55, dy: 0.08 },
  hexagon: { w: 0.65, h: 0.7, dy: 0 },
  octagon: { w: 0.7, h: 0.7, dy: 0 },
  star: { w: 0.4, h: 0.3, dy: 0.05 },
  plus: { w: 0.3, h: 0.3, dy: 0 },
  arrowLeft: { w: 0.5, h: 0.35, dy: 0 },
  arrowRight: { w: 0.5, h: 0.35, dy: 0 },
  chevron: { w: 0.5, h: 0.7, dy: 0 },
  speech: { w: 0.8, h: 0.55, dy: -0.12 },
  cylinder: { w: 0.8, h: 0.5, dy: 0.05 },
  document: { w: 0.8, h: 0.55, dy: -0.05 },
  process: { w: 0.7, h: 0.7, dy: 0 },
  slanted: { w: 0.8, h: 0.65, dy: 0.08 },
  frame: { w: 0.65, h: 0.65, dy: 0 },
};

const MAX_FIT = 48;
const MIN_FIT = 8;

// Centers `t` inside `s`, shrinking the font until the text fits. Mutates `t`.
export function layoutAttached(t: TextObject, s: ShapeObject) {
  const inset = INSET[s.shape] ?? DEFAULT_INSET;
  const innerW = Math.max(16, s.width * inset.w);
  const innerH = Math.max(10, s.height * inset.h);

  const longestWord = t.text
    .split(/\s+/)
    .reduce((a, b) => (b.length > a.length ? b : a), "");

  let fs = MAX_FIT;
  let h = measureHeight(t.text, fs, t.fontFamily, innerW);
  while (
    fs > MIN_FIT &&
    (h > innerH || measureWidth(longestWord, fs, t.fontFamily) > innerW)
  ) {
    fs -= 2;
    h = measureHeight(t.text, fs, t.fontFamily, innerW);
  }

  t.fontSize = fs;
  t.width = innerW;
  t.height = h;

  // center of the usable area, in world coordinates (shape may be rotated)
  const r = (s.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const lx = s.width / 2;
  const ly = s.height / 2 + inset.dy * s.height;
  const cx = s.x + lx * cos - ly * sin;
  const cy = s.y + lx * sin + ly * cos;

  // top-left of the text so its center sits on (cx, cy)
  t.x = cx - ((innerW / 2) * cos - (h / 2) * sin);
  t.y = cy - ((innerW / 2) * sin + (h / 2) * cos);
  t.rotation = s.rotation;
}