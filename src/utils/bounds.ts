import type { BoardObject } from "../types";

// Axis-aligned bounding box of an object in world coordinates (handles rotation)
export function objectBounds(o: BoardObject) {
  const w = o.width;
  const h = o.height;
  const r = (o.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);

  const corners: [number, number][] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  const pts = corners.map(([px, py]) => ({
    x: o.x + px * cos - py * sin,
    y: o.y + px * sin + py * cos,
  }));

  return {
    minX: Math.min(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxX: Math.max(...pts.map((p) => p.x)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}

// Is the world point (px, py) inside a (possibly rotated) rectangle?
export function pointInRect(
  px: number,
  py: number,
  r: { x: number; y: number; width: number; height: number; rotation: number }
) {
  const a = (-r.rotation * Math.PI) / 180;
  const dx = px - r.x;
  const dy = py - r.y;
  const lx = dx * Math.cos(a) - dy * Math.sin(a);
  const ly = dx * Math.sin(a) + dy * Math.cos(a);
  return lx >= 0 && lx <= r.width && ly >= 0 && ly <= r.height;
}