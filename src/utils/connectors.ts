import type { BoardObject, ConnEnd, Connector, Side } from "../types";

export const SIDES: Side[] = ["top", "right", "bottom", "left"];

type P = { x: number; y: number };

const rad = (deg: number) => (deg * Math.PI) / 180;

// local point (relative to the object's top-left) -> world point
function toWorld(o: BoardObject, lx: number, ly: number): P {
  const r = rad(o.rotation);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: o.x + lx * cos - ly * sin, y: o.y + lx * sin + ly * cos };
}

// world point -> local point
function toLocal(o: BoardObject, x: number, y: number): P {
  const r = rad(o.rotation);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = x - o.x;
  const dy = y - o.y;
  return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
}

export function anchorPoint(o: BoardObject, side: Side): P {
  switch (side) {
    case "top":
      return toWorld(o, o.width / 2, 0);
    case "right":
      return toWorld(o, o.width, o.height / 2);
    case "bottom":
      return toWorld(o, o.width / 2, o.height);
    default:
      return toWorld(o, 0, o.height / 2);
  }
}

// direction pointing out of the object at that side (world space)
function sideNormal(o: BoardObject, side: Side): P {
  const local =
    side === "top"
      ? { x: 0, y: -1 }
      : side === "right"
        ? { x: 1, y: 0 }
        : side === "bottom"
          ? { x: 0, y: 1 }
          : { x: -1, y: 0 };
  const r = rad(o.rotation);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: local.x * cos - local.y * sin, y: local.x * sin + local.y * cos };
}

export function nearestSide(o: BoardObject, x: number, y: number): Side {
  let best: Side = "top";
  let bestD = Infinity;
  for (const s of SIDES) {
    const p = anchorPoint(o, s);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

// topmost object under the point (shapes, pictures and free text can be connected)
export function hitObject(
  x: number,
  y: number,
  objects: Record<string, BoardObject>,
  margin: number
): BoardObject | null {
  const list = Object.values(objects);
  const ordered = [
    ...list.filter((o) => o.type !== "text"),
    ...list.filter((o) => o.type === "text"),
  ];
  for (let i = ordered.length - 1; i >= 0; i--) {
    const o = ordered[i];
    if (o.type === "text" && o.parentId) continue; // text inside a shape: the shape is the target
    const l = toLocal(o, x, y);
    if (
      l.x >= -margin &&
      l.x <= o.width + margin &&
      l.y >= -margin &&
      l.y <= o.height + margin
    ) {
      return o;
    }
  }
  return null;
}

type Resolved = { p: P; dir: P | null };

function resolve(e: ConnEnd, objects: Record<string, BoardObject>): Resolved | null {
  if ("objectId" in e) {
    const o = objects[e.objectId];
    if (!o) return null;
    return { p: anchorPoint(o, e.side), dir: sideNormal(o, e.side) };
  }
  return { p: { x: e.x, y: e.y }, dir: null };
}

const norm = (v: P): P => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};

// triangle with its tip at `tip`, pointing along `dir`
function arrowHead(tip: P, dir: P): number[] {
  const size = 13;
  const half = 6;
  const d = norm(dir);
  const bx = tip.x - d.x * size;
  const by = tip.y - d.y * size;
  return [
    tip.x, tip.y,
    bx - d.y * half, by + d.x * half,
    bx + d.y * half, by - d.x * half,
  ];
}

export type ConnectorShape = {
  d: string;
  startHead: number[] | null;
  endHead: number[] | null;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  p0: P;
  p3: P;
};

export function connectorShape(
  c: Connector,
  objects: Record<string, BoardObject>
): ConnectorShape | null {
  const a = resolve(c.from, objects);
  const b = resolve(c.to, objects);
  if (!a || !b) return null;

  const p0 = a.p;
  const p3 = b.p;
  const dist = Math.hypot(p3.x - p0.x, p3.y - p0.y);

  let d: string;
  let c1: P = p3; // used to find the arrow direction at the start
  let c2: P = p0; // used to find the arrow direction at the end

  if (c.style === "curved") {
    const reach = Math.max(40, dist * 0.4);
    const toB = norm({ x: p3.x - p0.x, y: p3.y - p0.y });
    const dirA = a.dir ?? toB;
    const dirB = b.dir ?? { x: -toB.x, y: -toB.y };
    c1 = { x: p0.x + dirA.x * reach, y: p0.y + dirA.y * reach };
    c2 = { x: p3.x + dirB.x * reach, y: p3.y + dirB.y * reach };
    d = `M ${p0.x} ${p0.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p3.x} ${p3.y}`;
  } else {
    d = `M ${p0.x} ${p0.y} L ${p3.x} ${p3.y}`;
  }

  const startHead = c.arrowStart
    ? arrowHead(p0, { x: p0.x - c1.x, y: p0.y - c1.y })
    : null;
  const endHead = c.arrowEnd
    ? arrowHead(p3, { x: p3.x - c2.x, y: p3.y - c2.y })
    : null;

  const xs = [p0.x, p3.x, ...(c.style === "curved" ? [c1.x, c2.x] : [])];
  const ys = [p0.y, p3.y, ...(c.style === "curved" ? [c1.y, c2.y] : [])];

  return {
    d,
    startHead,
    endHead,
    bbox: {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    },
    p0,
    p3,
  };
}