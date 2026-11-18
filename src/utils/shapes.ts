import type { ShapeKind } from "../types";

type Pt = [number, number];

// points are fractions (0 to 1) of width/height
const poly = (pts: Pt[], w: number, h: number) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${x * w} ${y * h}`).join(" ") + " Z";

const starPts = (): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 0.5 : 0.21;
    pts.push([0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)]);
  }
  return pts;
};

// Returns SVG path data for a shape drawn inside a w x h box
export function shapePath(kind: ShapeKind, w: number, h: number): string {
  switch (kind) {
    case "square":
      return `M0 0H${w}V${h}H0Z`;
    case "rounded": {
      const r = Math.min(w, h) * 0.2;
      return (
        `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${h - r}` +
        `A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}` +
        `V${r}A${r} ${r} 0 0 1 ${r} 0Z`
      );
    }
    case "circle":
      return (
        `M0 ${h / 2}A${w / 2} ${h / 2} 0 1 0 ${w} ${h / 2}` +
        `A${w / 2} ${h / 2} 0 1 0 0 ${h / 2}Z`
      );
    case "diamond":
      return poly([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]], w, h);
    case "triangle":
      return poly([[0.5, 0], [1, 1], [0, 1]], w, h);
    case "invTriangle":
      return poly([[0, 0], [1, 0], [0.5, 1]], w, h);
    case "parallelogramR":
      return poly([[0.25, 0], [1, 0], [0.75, 1], [0, 1]], w, h);
    case "parallelogramL":
      return poly([[0, 0], [0.75, 0], [1, 1], [0.25, 1]], w, h);
    case "trapezoid":
      return poly([[0.2, 0], [0.8, 0], [1, 1], [0, 1]], w, h);
    case "pentagon":
      return poly([[0.5, 0], [1, 0.38], [0.81, 1], [0.19, 1], [0, 0.38]], w, h);
    case "hexagon":
      return poly(
        [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]],
        w,
        h
      );
    case "octagon":
      return poly(
        [
          [0.3, 0], [0.7, 0], [1, 0.3], [1, 0.7],
          [0.7, 1], [0.3, 1], [0, 0.7], [0, 0.3],
        ],
        w,
        h
      );
    case "star":
      return poly(starPts(), w, h);
    case "plus":
      return poly(
        [
          [0.35, 0], [0.65, 0], [0.65, 0.35], [1, 0.35],
          [1, 0.65], [0.65, 0.65], [0.65, 1], [0.35, 1],
          [0.35, 0.65], [0, 0.65], [0, 0.35], [0.35, 0.35],
        ],
        w,
        h
      );
    case "arrowLeft":
      return poly(
        [[0, 0.5], [0.4, 0], [0.4, 0.3], [1, 0.3], [1, 0.7], [0.4, 0.7], [0.4, 1]],
        w,
        h
      );
    case "arrowRight":
      return poly(
        [[1, 0.5], [0.6, 0], [0.6, 0.3], [0, 0.3], [0, 0.7], [0.6, 0.7], [0.6, 1]],
        w,
        h
      );
    case "chevron":
      return poly(
        [[0, 0], [0.7, 0], [1, 0.5], [0.7, 1], [0, 1], [0.3, 0.5]],
        w,
        h
      );
    case "speech":
      return poly(
        [[0, 0], [1, 0], [1, 0.75], [0.45, 0.75], [0.2, 1], [0.25, 0.75], [0, 0.75]],
        w,
        h
      );
    case "cylinder": {
      const ry = h * 0.15;
      return (
        `M0 ${ry}A${w / 2} ${ry} 0 0 1 ${w} ${ry}V${h - ry}` +
        `A${w / 2} ${ry} 0 0 1 0 ${h - ry}Z` +
        `M0 ${ry}A${w / 2} ${ry} 0 0 0 ${w} ${ry}`
      );
    }
    case "document":
      return (
        `M0 0H${w}V${h * 0.85}Q${w * 0.75} ${h * 0.7} ${w * 0.5} ${h * 0.85}` +
        `T0 ${h * 0.85}Z`
      );
    case "process":
      return (
        `M0 0H${w}V${h}H0Z` +
        `M${w * 0.12} 0V${h}M${w * 0.88} 0V${h}`
      );
    case "slanted":
      return poly([[0, 0.2], [1, 0], [1, 1], [0, 1]], w, h);
    case "frame":
      return (
        `M0 0H${w}V${h}H0Z` +
        `M${w * 0.14} ${h * 0.14}V${h * 0.86}H${w * 0.86}V${h * 0.14}Z`
      );
    default:
      return `M0 0H${w}V${h}H0Z`;
  }
}

// Order shown in the picker (3 rows like the reference)
export const SHAPES: { kind: ShapeKind; label: string }[] = [
  { kind: "square", label: "Square" },
  { kind: "rounded", label: "Rounded square" },
  { kind: "circle", label: "Circle" },
  { kind: "diamond", label: "Diamond" },
  { kind: "triangle", label: "Triangle" },
  { kind: "invTriangle", label: "Inverted triangle" },
  { kind: "parallelogramR", label: "Parallelogram" },
  { kind: "parallelogramL", label: "Parallelogram (left)" },
  { kind: "trapezoid", label: "Trapezoid" },
  { kind: "pentagon", label: "Pentagon" },
  { kind: "hexagon", label: "Hexagon" },
  { kind: "octagon", label: "Octagon" },
  { kind: "star", label: "Star" },
  { kind: "plus", label: "Plus" },
  { kind: "arrowLeft", label: "Arrow left" },
  { kind: "arrowRight", label: "Arrow right" },
  { kind: "chevron", label: "Chevron" },
  { kind: "speech", label: "Speech bubble" },
  { kind: "cylinder", label: "Cylinder" },
  { kind: "document", label: "Document" },
  { kind: "process", label: "Process" },
  { kind: "slanted", label: "Slanted rectangle" },
  { kind: "frame", label: "Frame" },
];