import type { BoardObject, ConnEnd, Connector, Side } from "../types";
import { measureWidth } from "./textLayout";
import { pointInRect } from "./bounds";

export type Pt = { x: number; y: number };

export const SIDES: Side[] = ["top", "right", "bottom", "left"];

const HEAD = 14; // arrowhead size in world units

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const unit = (v: Pt): Pt => {
  const len = Math.hypot(v.x, v.y);
  return len < 1e-6 ? { x: 1, y: 0 } : { x: v.x / len, y: v.y / len };
};

// the box a connector attaches to, in the object's own (unrotated) space.
// Text uses its real text width, not the wider invisible box around it.
function localBox(o: BoardObject) {
  if (o.type === "shape") return { x0: 0, y0: 0, w: o.width, h: o.height };
  const eff = Math.max(
    12,
    Math.min(o.width, measureWidth(o.text, o.fontSize, o.fontFamily))
  );
  const x0 = o.parentId ? (o.width - eff) / 2 : 0;
  return { x0, y0: 0, w: eff, h: o.height };
}

function toWorld(o: BoardObject, lx: number, ly: number): Pt {
  const r = (o.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: o.x + lx * cos - ly * sin, y: o.y + lx * sin + ly * cos };
}

// world position of the middle of one side of an object
export function anchorPoint(o: BoardObject, side: Side): Pt {
  const b = localBox(o);
  const local: Record<Side, [number, number]> = {
    top: [b.x0 + b.w / 2, b.y0],
    right: [b.x0 + b.w, b.y0 + b.h / 2],
    bottom: [b.x0 + b.w / 2, b.y0 + b.h],
    left: [b.x0, b.y0 + b.h / 2],
  };
  const [lx, ly] = local[side];
  return toWorld(o, lx, ly);
}

// direction pointing out of a side (in world space)
function sideNormal(rotation: number, side: Side): Pt {
  const local: Record<Side, Pt> = {
    top: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    bottom: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
  };
  const n = local[side];
  const r = (rotation * Math.PI) / 180;
  return {
    x: n.x * Math.cos(r) - n.y * Math.sin(r),
    y: n.x * Math.sin(r) + n.y * Math.cos(r),
  };
}

export function nearestSide(o: BoardObject, px: number, py: number): Side {
  let best: Side = "top";
  let bestD = Infinity;
  for (const s of SIDES) {
    const p = anchorPoint(o, s);
    const d = (p.x - px) ** 2 + (p.y - py) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

// topmost connectable object under a world point (text sits above shapes;
// text snapped inside a shape is skipped so you connect to the shape itself)
export function hitObject(
  px: number,
  py: number,
  objects: Record<string, BoardObject>,
  margin: number
): BoardObject | null {
  const list = Object.values(objects);
  const ordered = [
    ...list.filter((o) => o.type === "shape"),
    ...list.filter((o) => o.type === "text" && !o.parentId),
  ];
  for (let i = ordered.length - 1; i >= 0; i--) {
    const o = ordered[i];
    const b = localBox(o);
    const origin = toWorld(o, b.x0 - margin, b.y0 - margin);
    if (
      pointInRect(px, py, {
        x: origin.x,
        y: origin.y,
        width: b.w + margin * 2,
        height: b.h + margin * 2,
        rotation: o.rotation,
      })
    ) {
      return o;
    }
  }
  return null;
}

function resolveEnd(
  end: ConnEnd,
  objects: Record<string, BoardObject>
): { p: Pt; n: Pt | null } | null {
  if ("objectId" in end) {
    const o = objects[end.objectId];
    if (!o) return null;
    return { p: anchorPoint(o, end.side), n: sideNormal(o.rotation, end.side) };
  }
  return { p: { x: end.x, y: end.y }, n: null };
}

// flat triangle points [x1,y1,x2,y2,x3,y3] for an arrowhead at `tip`
// pointing in direction `d`
function headPoints(tip: Pt, d: Pt): number[] {
  const bx = tip.x - d.x * HEAD;
  const by = tip.y - d.y * HEAD;
  const nx = -d.y;
  const ny = d.x;
  const w = HEAD * 0.45;
  return [tip.x, tip.y, bx + nx * w, by + ny * w, bx - nx * w, by - ny * w];
}

export type ConnectorShape = {
  d: string; // SVG path of the line
  p0: Pt; // real start point
  p3: Pt; // real end point
  startHead: number[] | null;
  endHead: number[] | null;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
};

// Everything needed to draw a connector. Returns null if an attached object
// no longer exists.
export function connectorShape(
  c: Connector,
  objects: Record<string, BoardObject>
): ConnectorShape | null {
  const a = resolveEnd(c.from, objects);
  const b = resolveEnd(c.to, objects);
  if (!a || !b) return null;

  const p0 = a.p;
  const p3 = b.p;
  const curved = c.style === "curved";

  let p1 = p0;
  let p2 = p3;
  if (curved) {
    const dist = Math.hypot(p3.x - p0.x, p3.y - p0.y);
    const k = Math.max(40, dist * 0.4);
    const da = a.n ?? unit(sub(p3, p0));
    const db = b.n ?? unit(sub(p0, p3));
    p1 = { x: p0.x + da.x * k, y: p0.y + da.y * k };
    p2 = { x: p3.x + db.x * k, y: p3.y + db.y * k };
  }

  // direction of travel into each tip
  const dStart = unit(curved ? sub(p0, p1) : sub(p0, p3));
  const dEnd = unit(curved ? sub(p3, p2) : sub(p3, p0));

  // pull the line back so it ends at the base of the arrowhead
  const q0 = c.arrowStart
    ? { x: p0.x - dStart.x * HEAD * 0.8, y: p0.y - dStart.y * HEAD * 0.8 }
    : p0;
  const q3 = c.arrowEnd
    ? { x: p3.x - dEnd.x * HEAD * 0.8, y: p3.y - dEnd.y * HEAD * 0.8 }
    : p3;

  const d = `M${q0.x} ${q0.y}C${p1.x} ${p1.y} ${p2.x} ${p2.y} ${q3.x} ${q3.y}`;

  const mid = {
    x: (p0.x + 3 * p1.x + 3 * p2.x + p3.x) / 8,
    y: (p0.y + 3 * p1.y + 3 * p2.y + p3.y) / 8,
  };
  const xs = [p0.x, p3.x, mid.x];
  const ys = [p0.y, p3.y, mid.y];

  return {
    d,
    p0,
    p3,
    startHead: c.arrowStart ? headPoints(p0, dStart) : null,
    endHead: c.arrowEnd ? headPoints(p3, dEnd) : null,
    bbox: {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    },
  };
}