import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  MousePointer2,
  Hand,
  Pencil,
  Eraser,
  Shapes,
  Type,
  ArrowUpRight,
  Image as ImageIcon,
  Undo2,
  Redo2,
  Trash2,
} from "lucide-react";
import { useBoard } from "../store";
import { screenToWorld } from "../utils/coords";
import { DEFAULT_FONT } from "../utils/textLayout";
import type { ShapeKind } from "../types";
import ShapePicker from "./ShapePicker";

const uid = () => crypto.randomUUID();

type IconType = ComponentType<{ size?: number; strokeWidth?: number }>;

function ToolButton({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: IconType;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      title={disabled ? `${label} (coming soon)` : label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        display: "grid",
        placeItems: "center",
        border: "none",
        borderRadius: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
        background: active ? "var(--primary-soft)" : "transparent",
        color: active ? "var(--primary)" : "var(--text-2)",
        transition: "background .15s, color .15s",
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled)
          e.currentTarget.style.background = "var(--surface-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <Icon size={20} strokeWidth={1.75} />
    </button>
  );
}

const Divider = () => (
  <div
    style={{ height: 1, width: 24, background: "var(--border)", margin: "4px 0" }}
  />
);

export default function Toolbar() {
  const addObject = useBoard((s) => s.addObject);
  const viewport = useBoard((s) => s.viewport);
  const selectedIds = useBoard((s) => s.selectedIds);
  const selectedConnectorId = useBoard((s) => s.selectedConnectorId);
  const select = useBoard((s) => s.select);
  const deleteObjects = useBoard((s) => s.deleteObjects);
  const deleteConnector = useBoard((s) => s.deleteConnector);
  const setEditing = useBoard((s) => s.setEditing);
  const tool = useBoard((s) => s.tool);
  const setTool = useBoard((s) => s.setTool);

  const [shapesOpen, setShapesOpen] = useState(false);
  const shapesRef = useRef<HTMLDivElement>(null);

  // close the shape popup on outside click or Escape
  useEffect(() => {
    if (!shapesOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!shapesRef.current?.contains(e.target as Node)) setShapesOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShapesOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [shapesOpen]);

  // place new things at the center of what the user currently sees
  const center = () =>
    screenToWorld(window.innerWidth / 2, window.innerHeight / 2, viewport);

  const addShape = (shape: ShapeKind) => {
    const c = center();
    const id = uid();
    addObject({
      id,
      type: "shape",
      shape,
      x: c.x - 80,
      y: c.y - 80,
      width: 160,
      height: 160,
      rotation: 0,
      fill: "#d3c0ff",
    });
    select([id]); // select it right away so the popup appears
    setTool("select");
    setShapesOpen(false);
  };

  // adds a text and opens it for typing right away
  const addText = () => {
    const c = center();
    const id = uid();
    addObject({
      id,
      type: "text",
      x: c.x - 100,
      y: c.y - 14,
      width: 200,
      height: 30,
      rotation: 0,
      text: "Text",
      fontSize: 28,
      fontFamily: DEFAULT_FONT,
    });
    select([id]);
    setTool("select");
    setEditing(id);
  };

  const nothingSelected = selectedIds.length === 0 && !selectedConnectorId;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: 6,
        background: "var(--surface)",
        borderRadius: 14,
        boxShadow: "0 4px 16px var(--shadow)",
        transition: "background 0.25s, box-shadow 0.25s",
      }}
    >
      <ToolButton
        icon={MousePointer2}
        label="Select (V)"
        active={tool === "select"}
        onClick={() => setTool("select")}
      />
      <ToolButton
        icon={Hand}
        label="Hand (H)"
        active={tool === "hand"}
        onClick={() => setTool("hand")}
      />

      <Divider />

      <ToolButton icon={Pencil} label="Pen (P)" disabled />
      <ToolButton icon={Eraser} label="Eraser (E)" disabled />

      <Divider />

      {/* Shapes button with popup beside it */}
      <div ref={shapesRef} style={{ position: "relative" }}>
        <ToolButton
          icon={Shapes}
          label="Shapes"
          active={shapesOpen}
          onClick={() => setShapesOpen((o) => !o)}
        />
        {shapesOpen && <ShapePicker onPick={addShape} />}
      </div>

      <ToolButton icon={Type} label="Text" onClick={addText} />
      <ToolButton
        icon={ArrowUpRight}
        label="Connector (C)"
        active={tool === "connector"}
        onClick={() => setTool(tool === "connector" ? "select" : "connector")}
      />
      <ToolButton icon={ImageIcon} label="Image (I)" disabled />

      <Divider />

      <ToolButton icon={Undo2} label="Undo" disabled />
      <ToolButton icon={Redo2} label="Redo" disabled />
      <ToolButton
        icon={Trash2}
        label="Delete"
        disabled={nothingSelected}
        onClick={() => {
          if (selectedConnectorId) deleteConnector(selectedConnectorId);
          else deleteObjects(selectedIds);
        }}
      />
    </div>
  );
}