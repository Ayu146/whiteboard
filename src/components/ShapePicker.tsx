import { useState } from "react";
import type { CSSProperties } from "react";
import type { ShapeKind } from "../types";
import { SHAPES, shapePath } from "../utils/shapes";

export function ShapeIcon({ kind }: { kind: ShapeKind }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d={shapePath(kind, 18, 18)}
        transform="translate(3,3)"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function ShapePicker({
  onPick,
  style,
}: {
  onPick: (kind: ShapeKind) => void;
  style?: CSSProperties; // lets the caller place the popup differently
}) {
  const [hovered, setHovered] = useState<ShapeKind | null>(null);

  return (
    <div
      style={{
        position: "absolute",
        left: "calc(100% + 14px)",
        top: "50%",
        transform: "translateY(-50%)",
        display: "grid",
        gridTemplateColumns: "repeat(8, 36px)",
        gap: 4,
        padding: 8,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        boxShadow: "0 8px 28px var(--shadow)",
        zIndex: 20,
        ...style,
      }}
    >
      {SHAPES.map(({ kind, label }) => (
        <button
          key={kind}
          title={label}
          aria-label={label}
          onClick={() => onPick(kind)}
          onMouseEnter={() => setHovered(kind)}
          onMouseLeave={() => setHovered(null)}
          style={{
            width: 36,
            height: 36,
            display: "grid",
            placeItems: "center",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            background: hovered === kind ? "var(--primary-soft)" : "transparent",
            color: hovered === kind ? "var(--primary)" : "var(--text-2)",
            transition: "background .12s, color .12s",
          }}
        >
          <ShapeIcon kind={kind} />
        </button>
      ))}
    </div>
  );
}