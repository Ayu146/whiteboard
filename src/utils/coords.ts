import type { Viewport } from "../types";

export function screenToWorld(sx: number, sy: number, v: Viewport) {
  return { x: (sx - v.x) / v.zoom, y: (sy - v.y) / v.zoom };
}

export function worldToScreen(wx: number, wy: number, v: Viewport) {
  return { x: wx * v.zoom + v.x, y: wy * v.zoom + v.y };
}