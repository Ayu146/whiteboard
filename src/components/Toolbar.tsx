import { useRef, useState } from "react";
import {
  MousePointer2,
  Hand,
  Spline,
  Type,
  Shapes,
  ImagePlus,
  Undo2,
  Redo2,
} from "lucide-react";
import { useBoard } from "../store";
import { shapePath } from "../utils/shapes";
import { screenToWorld } from "../utils/coords";
import { DEFAULT_FONT } from "../utils/textLayout";
import { addImageFiles } from "../utils/images";
import type { ShapeKind, Tool } from "../types";

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl+";

const KINDS: ShapeKind[] = [
  "square", "rounded", "circle", "diamond", "triangle", "invTriangle",
  "parallelogramR", "parallelogramL", "trapezoid", "pentagon", "hexagon", "octagon",
  "star", "plus", "arrowLeft", "arrowRight", "chevron", "speech",
  "cylinder", "document", "process", "slanted", "frame",
];

const FILL = "#ddd6fe";

const pill = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  padding: 6,
  background: "var(--surface)",
  borderRadius: 14,
  boxShadow: "0 4px 16px var(--shadow)",
} as const;

function btnStyle(active: boolean, enabled = true) {
  return {
    width: 40,
    height: 40,
    display: "grid",
    placeItems: "center",
    border: "none",
    borderRadius: 10,
    background: active ? "var(--primary)" : "transparent",
    color: active ? "#ffffff" : "var(--text)",
    opacity: enabled ? 1 : 0.35,
    cursor: enabled ? "pointer" : "default",
  } as const;
}

const divider = {
  width: 24,
  height: 1,
  background: "var(--text-2)",
  opacity: 0.25,
  margin: "2px 0",
} as const;

export default function Toolbar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [shapesOpen, setShapesOpen] = useState(false);

  const tool = useBoard((s) => s.tool);
  const setTool = useBoard((s) => s.setTool);
  const canUndo = useBoard((s) => s.past.length > 0);
  const canRedo = useBoard((s) => s.future.length > 0);
  const undo = useBoard((s) => s.undo);
  const redo = useBoard((s) => s.redo);

  const pickTool = (t: Tool) => {
    setTool(t);
    setShapesOpen(false);
  };

  const addShape = (kind: ShapeKind) => {
    const st = useBoard.getState();
    const c = screenToWorld(window.innerWidth / 2, window.innerHeight / 2, st.viewport);
    const w = kind === "frame" ? 320 : 140;
    const h = kind === "frame" ? 220 : 100;
    const id = crypto.randomUUID();
    st.addObject({
      id,
      type: "shape",
      shape: kind,
      fill: FILL,
      x: c.x - w / 2,
      y: c.y - h / 2,
      width: w,
      height: h,
      rotation: 0,
    });
    st.select([id]);
    st.setTool("select");
    setShapesOpen(false);
  };

  const addText = () => {
    const st = useBoard.getState();
    const c = screenToWorld(window.innerWidth / 2, window.innerHeight / 2, st.viewport);
    const id = crypto.randomUUID();
    st.addObject({
      id,
      type: "text",
      text: "",
      fontSize: 24,
      fontFamily: DEFAULT_FONT,
      x: c.x - 100,
      y: c.y - 15,
      width: 200,
      height: 30,
      rotation: 0,
    });
    st.setTool("select");
    st.select([id]);
    st.setEditing(id);
    setShapesOpen(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={pill}>
        <button
          style={btnStyle(tool === "select")}
          onClick={() => pickTool("select")}
          title="Select (V)"
          aria-label="Select"
        >
          <MousePointer2 size={19} strokeWidth={1.75} />
        </button>
        <button
          style={btnStyle(tool === "hand")}
          onClick={() => pickTool("hand")}
          title="Hand / pan (H)"
          aria-label="Hand"
        >
          <Hand size={19} strokeWidth={1.75} />
        </button>
        <button
          style={btnStyle(tool === "connector")}
          onClick={() => pickTool("connector")}
          title="Connector (C)"
          aria-label="Connector"
        >
          <Spline size={19} strokeWidth={1.75} />
        </button>

        <div style={divider} />

        <button
          style={btnStyle(shapesOpen)}
          onClick={() => setShapesOpen((o) => !o)}
          title="Shapes"
          aria-label="Shapes"
        >
          <Shapes size={19} strokeWidth={1.75} />
        </button>
        <button style={btnStyle(false)} onClick={addText} title="Text" aria-label="Text">
          <Type size={19} strokeWidth={1.75} />
        </button>
        <button
          style={btnStyle(false)}
          onClick={() => fileRef.current?.click()}
          title="Add image (or drag & drop, or paste)"
          aria-label="Add image"
        >
          <ImagePlus size={19} strokeWidth={1.75} />
        </button>

        <div style={divider} />

        <button
          style={btnStyle(false, canUndo)}
          onClick={() => undo()}
          disabled={!canUndo}
          title={`Undo (${MOD}Z)`}
          aria-label="Undo"
        >
          <Undo2 size={19} strokeWidth={1.75} />
        </button>
        <button
          style={btnStyle(false, canRedo)}
          onClick={() => redo()}
          disabled={!canRedo}
          title={`Redo (${MOD}${isMac ? "⇧Z" : "Shift+Z"} or ${MOD}Y)`}
          aria-label="Redo"
        >
          <Redo2 size={19} strokeWidth={1.75} />
        </button>
      </div>

      {shapesOpen && (
        <div
          style={{
            position: "absolute",
            left: "calc(100% + 10px)",
            top: 0,
            display: "grid",
            gridTemplateColumns: "repeat(6, 40px)",
            gap: 4,
            padding: 8,
            background: "var(--surface)",
            borderRadius: 14,
            boxShadow: "0 4px 16px var(--shadow)",
          }}
        >
          {KINDS.map((k) => (
            <button
              key={k}
              title={k}
              aria-label={k}
              onClick={() => addShape(k)}
              style={{
                width: 40,
                height: 40,
                display: "grid",
                placeItems: "center",
                border: "none",
                borderRadius: 10,
                background: "transparent",
                cursor: "pointer",
              }}
            >
              <svg width="26" height="26" viewBox="0 0 26 26">
                <path
                  d={shapePath(k, 22, 22)}
                  transform="translate(2 2)"
                  fill="none"
                  stroke="var(--text)"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) addImageFiles(files);
        }}
      />
    </div>
  );
}