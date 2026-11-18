import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useBoard } from "../store";
import type { ShapeKind, ShapeObject, TextObject } from "../types";
import { FONTS } from "../utils/textLayout";
import ShapePicker, { ShapeIcon } from "./ShapePicker";

export type ScreenRect = { x: number; y: number; width: number; height: number };

const COLORS = [
  "#ffe58f", // yellow
  "#ffc999", // orange
  "#ffaba5", // red
  "#f8bbe0", // pink
  "#d3c0ff", // purple
  "#afd6ff", // blue
  "#c3e9a4", // green
  "#e5e5e5", // gray
];

const TEXT_COLORS = [
  "#2a1f36",
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ffffff",
];

const SIZES = [
  { label: "S", value: 80 },
  { label: "M", value: 120 },
  { label: "L", value: 160 },
  { label: "XL", value: 240 },
];

const TEXT_SIZES = [
  { label: "S", value: 16 },
  { label: "M", value: 24 },
  { label: "L", value: 36 },
  { label: "XL", value: 56 },
];

const Divider = () => (
  <div
    style={{ width: 1, height: 24, background: "var(--border)", margin: "0 4px" }}
  />
);

function ColorWheel({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <label
      title="Custom color"
      style={{
        position: "relative",
        display: "block",
        width: 24,
        height: 24,
        borderRadius: "50%",
        cursor: "pointer",
        background:
          "conic-gradient(#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
        border: "1px solid rgba(0,0,0,.15)",
        flexShrink: 0,
      }}
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0,
          cursor: "pointer",
          border: 0,
          padding: 0,
        }}
      />
    </label>
  );
}

export default function SelectionToolbar({ rect }: { rect: ScreenRect }) {
  const objects = useBoard((s) => s.objects);
  const selectedIds = useBoard((s) => s.selectedIds);
  const updateObjects = useBoard((s) => s.updateObjects);

  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // close the shape dropdown when clicking elsewhere
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickerOpen]);

  const shapes = selectedIds
    .map((id) => objects[id])
    .filter((o): o is ShapeObject => o?.type === "shape");
  const texts = selectedIds
    .map((id) => objects[id])
    .filter((o): o is TextObject => o?.type === "text");
  const freeTexts = texts.filter((t) => !t.parentId);

  if (shapes.length === 0 && texts.length === 0) return null;

  // ----- shape actions -----
  const applyColor = (fill: string) => {
    updateObjects(Object.fromEntries(shapes.map((s) => [s.id, { fill }])));
  };

  const applyShape = (shape: ShapeKind) => {
    updateObjects(Object.fromEntries(shapes.map((s) => [s.id, { shape }])));
    setPickerOpen(false);
  };

  // scale so the longer side equals `value`, keeping the center in place
  const applySize = (value: number) => {
    const patches: Record<string, Partial<ShapeObject>> = {};
    for (const s of shapes) {
      const k = value / Math.max(s.width, s.height);
      const w = s.width * k;
      const h = s.height * k;
      patches[s.id] = {
        width: w,
        height: h,
        x: s.x + (s.width - w) / 2,
        y: s.y + (s.height - h) / 2,
      };
    }
    updateObjects(patches);
  };

  // ----- text actions -----
  const applyTextColor = (color: string) => {
    updateObjects(Object.fromEntries(texts.map((t) => [t.id, { color }])));
  };

  const applyFont = (fontFamily: string) => {
    updateObjects(Object.fromEntries(texts.map((t) => [t.id, { fontFamily }])));
  };

  // free text only (text inside a shape is sized automatically)
  const applyTextSize = (value: number) => {
    const patches: Record<string, Partial<TextObject>> = {};
    for (const t of freeTexts) {
      const k = value / t.fontSize;
      patches[t.id] = { fontSize: value, width: t.width * k };
    }
    updateObjects(patches);
  };

  const activeFill =
    shapes.length > 0 && shapes.every((s) => s.fill === shapes[0].fill)
      ? shapes[0].fill
      : null;

  const sameFont =
    texts.length > 0 && texts.every((t) => t.fontFamily === texts[0].fontFamily);
  const textColor = texts[0]?.color ?? "#2a1f36";
  const activeTextColor =
    texts.length > 0 && texts.every((t) => t.color === texts[0].color)
      ? texts[0].color
      : undefined;

  // place above the selection, flip below if there is no room
  const above = rect.y > 90;
  const cx = Math.min(
    Math.max(rect.x + rect.width / 2, 340),
    window.innerWidth - 340
  );

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        left: cx,
        top: above ? rect.y - 14 : rect.y + rect.height + 46,
        transform: above ? "translate(-50%, -100%)" : "translate(-50%, 0)",
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        boxShadow: "0 8px 28px var(--shadow)",
        zIndex: 15,
        whiteSpace: "nowrap",
      }}
    >
      {/* ---------- shape controls ---------- */}
      {shapes.length > 0 && (
        <>
          {COLORS.map((c) => (
            <button
              key={c}
              title={c}
              aria-label={`Color ${c}`}
              onClick={() => applyColor(c)}
              style={{
                width: 24,
                height: 24,
                borderRadius: 7,
                background: c,
                cursor: "pointer",
                border:
                  activeFill === c
                    ? "2px solid var(--primary)"
                    : "1px solid rgba(0,0,0,.12)",
                boxShadow:
                  activeFill === c ? "0 0 0 2px var(--primary-soft)" : "none",
                padding: 0,
              }}
            />
          ))}

          <Divider />

          <div ref={pickerRef} style={{ position: "relative" }}>
            <button
              title="Change shape"
              aria-label="Change shape"
              onClick={() => setPickerOpen((o) => !o)}
              style={{
                height: 32,
                display: "flex",
                alignItems: "center",
                gap: 2,
                padding: "0 6px",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                background: pickerOpen ? "var(--primary-soft)" : "transparent",
                color: pickerOpen ? "var(--primary)" : "var(--text-2)",
              }}
            >
              <ShapeIcon kind={shapes[0].shape} />
              <ChevronDown size={14} strokeWidth={2} />
            </button>
            {pickerOpen && (
              <ShapePicker
                onPick={applyShape}
                style={
                  above
                    ? {
                        top: "auto",
                        bottom: "calc(100% + 12px)",
                        left: "50%",
                        transform: "translateX(-50%)",
                      }
                    : {
                        top: "calc(100% + 12px)",
                        bottom: "auto",
                        left: "50%",
                        transform: "translateX(-50%)",
                      }
                }
              />
            )}
          </div>

          <Divider />

          {SIZES.map(({ label, value }) => {
            const active = shapes.every(
              (s) => Math.round(Math.max(s.width, s.height)) === value
            );
            return (
              <button
                key={label}
                title={`${label} (${value}px)`}
                onClick={() => applySize(value)}
                style={{
                  minWidth: 32,
                  height: 32,
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                  background: active ? "var(--primary-soft)" : "transparent",
                  color: active ? "var(--primary)" : "var(--text-2)",
                }}
              >
                {label}
              </button>
            );
          })}
        </>
      )}

      {shapes.length > 0 && texts.length > 0 && <Divider />}

      {/* ---------- text controls ---------- */}
      {texts.length > 0 && (
        <>
          <select
            title="Font"
            aria-label="Font"
            value={sameFont ? texts[0].fontFamily : ""}
            onChange={(e) => applyFont(e.target.value)}
            style={{
              height: 32,
              padding: "0 8px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: sameFont ? texts[0].fontFamily : "inherit",
            }}
          >
            {!sameFont && (
              <option value="" disabled hidden>
                Mixed
              </option>
            )}
            {FONTS.map((f) => (
              <option key={f.label} value={f.value} style={{ fontFamily: f.value }}>
                {f.label}
              </option>
            ))}
          </select>

          <Divider />

          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              title={c}
              aria-label={`Text color ${c}`}
              onClick={() => applyTextColor(c)}
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: c,
                cursor: "pointer",
                border:
                  activeTextColor === c
                    ? "2px solid var(--primary)"
                    : "1px solid rgba(0,0,0,.2)",
                boxShadow:
                  activeTextColor === c ? "0 0 0 2px var(--primary-soft)" : "none",
                padding: 0,
                flexShrink: 0,
              }}
            />
          ))}

          <ColorWheel value={textColor} onChange={applyTextColor} />

          {freeTexts.length > 0 && (
            <>
              <Divider />
              {TEXT_SIZES.map(({ label, value }) => {
                const active = freeTexts.every(
                  (t) => Math.round(t.fontSize) === value
                );
                return (
                  <button
                    key={label}
                    title={`${label} (${value}px)`}
                    onClick={() => applyTextSize(value)}
                    style={{
                      minWidth: 32,
                      height: 32,
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 13,
                      background: active ? "var(--primary-soft)" : "transparent",
                      color: active ? "var(--primary)" : "var(--text-2)",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}