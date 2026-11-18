import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { useBoard } from "../store";
import type { Connector } from "../types";
import type { ScreenRect } from "./SelectionToolbar";

const COLORS = [
  "#2a1f36",
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ffffff",
];

const Divider = () => (
  <div
    style={{ width: 1, height: 24, background: "var(--border)", margin: "0 4px" }}
  />
);

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function Btn({
  active = false,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        display: "grid",
        placeItems: "center",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        background: active ? "var(--primary-soft)" : "transparent",
        color: active ? "var(--primary)" : "var(--text-2)",
      }}
    >
      {children}
    </button>
  );
}

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

export default function ConnectorToolbar({
  connector,
  rect,
}: {
  connector: Connector;
  rect: ScreenRect;
}) {
  const updateConnector = useBoard((s) => s.updateConnector);
  const deleteConnector = useBoard((s) => s.deleteConnector);

  const set = (patch: Partial<Connector>) => updateConnector(connector.id, patch);

  const heads =
    connector.arrowStart && connector.arrowEnd
      ? "both"
      : connector.arrowEnd
      ? "end"
      : connector.arrowStart
      ? "start"
      : "none";

  const above = rect.y > 90;
  const cx = Math.min(
    Math.max(rect.x + rect.width / 2, 260),
    window.innerWidth - 260
  );

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        left: cx,
        top: above ? rect.y - 18 : rect.y + rect.height + 18,
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
      {COLORS.map((c) => (
        <button
          key={c}
          title={c}
          aria-label={`Color ${c}`}
          onClick={() => set({ color: c })}
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: c,
            cursor: "pointer",
            border:
              connector.color === c
                ? "2px solid var(--primary)"
                : "1px solid rgba(0,0,0,.2)",
            boxShadow:
              connector.color === c ? "0 0 0 2px var(--primary-soft)" : "none",
            padding: 0,
            flexShrink: 0,
          }}
        />
      ))}
      <ColorWheel
        value={connector.color ?? "#2a1f36"}
        onChange={(c) => set({ color: c })}
      />

      <Divider />

      <Btn
        title="Straight"
        active={connector.style === "straight"}
        onClick={() => set({ style: "straight" })}
      >
        <Icon>
          <path d="M5 19L19 5" />
        </Icon>
      </Btn>
      <Btn
        title="Curved"
        active={connector.style === "curved"}
        onClick={() => set({ style: "curved" })}
      >
        <Icon>
          <path d="M5 19C5 8 19 16 19 5" />
        </Icon>
      </Btn>

      <Divider />

      <Btn
        title="No arrowheads"
        active={heads === "none"}
        onClick={() => set({ arrowStart: false, arrowEnd: false })}
      >
        <Icon>
          <path d="M4 12H20" />
        </Icon>
      </Btn>
      <Btn
        title="Arrow at end"
        active={heads === "end"}
        onClick={() => set({ arrowStart: false, arrowEnd: true })}
      >
        <Icon>
          <path d="M4 12H19" />
          <path d="M14 7l5 5-5 5" />
        </Icon>
      </Btn>
      <Btn
        title="Arrow at start"
        active={heads === "start"}
        onClick={() => set({ arrowStart: true, arrowEnd: false })}
      >
        <Icon>
          <path d="M5 12H20" />
          <path d="M10 7l-5 5 5 5" />
        </Icon>
      </Btn>
      <Btn
        title="Arrows at both ends"
        active={heads === "both"}
        onClick={() => set({ arrowStart: true, arrowEnd: true })}
      >
        <Icon>
          <path d="M5 12H19" />
          <path d="M10 7l-5 5 5 5" />
          <path d="M14 7l5 5-5 5" />
        </Icon>
      </Btn>

      <Divider />

      <Btn
        title="Dashed"
        active={connector.dashed}
        onClick={() => set({ dashed: !connector.dashed })}
      >
        <Icon>
          <path d="M3 12h3M10.5 12h3M18 12h3" />
        </Icon>
      </Btn>

      <Divider />

      <Btn title="Delete connector" onClick={() => deleteConnector(connector.id)}>
        <Trash2 size={18} strokeWidth={1.75} />
      </Btn>
    </div>
  );
}