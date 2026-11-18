import { useEffect, useRef } from "react";
import type { TextObject, Viewport } from "../types";
import { worldToScreen } from "../utils/coords";

// A textarea laid exactly over the text on the canvas while it is being edited
export default function TextEditor({
  obj,
  viewport,
  color,
  onCommit,
}: {
  obj: TextObject;
  viewport: Viewport;
  color: string;
  onCommit: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  const finish = () => {
    if (done.current) return;
    done.current = true;
    commitRef.current(ref.current?.value ?? "");
  };

  const autosize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
    autosize();

    // the canvas swallows mouse events, so listen on the window ourselves
    const onDown = (e: MouseEvent) => {
      if (e.target !== el) finish();
    };
    window.addEventListener("mousedown", onDown, true);
    return () => window.removeEventListener("mousedown", onDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const z = viewport.zoom;
  const p = worldToScreen(obj.x, obj.y, viewport);
  const attached = !!obj.parentId;

  return (
    <textarea
      ref={ref}
      defaultValue={obj.text}
      onInput={autosize}
      onBlur={finish}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          finish();
        }
      }}
      style={{
        position: "fixed",
        left: p.x,
        top: p.y,
        width: obj.width * z,
        height: obj.height * z,
        transform: `rotate(${obj.rotation}deg)`,
        transformOrigin: "0 0",
        margin: 0,
        padding: 0,
        border: "none",
        outline: "1px dashed var(--primary)",
        outlineOffset: 2,
        background: "transparent",
        resize: "none",
        overflow: "hidden",
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
        fontSize: obj.fontSize * z,
        fontFamily: obj.fontFamily,
        lineHeight: 1,
        color,
        textAlign: attached ? "center" : "left",
        zIndex: 25,
      }}
    />
  );
}