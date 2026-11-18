import { useRef, useEffect, useState } from "react";
import {
  Stage,
  Layer,
  Path,
  Text,
  Transformer,
  Group,
  Line,
  Circle,
} from "react-konva";
import Konva from "konva";
import { useBoard } from "../store";
import { shapePath } from "../utils/shapes";
import { objectBounds, pointInRect } from "../utils/bounds";
import { screenToWorld, worldToScreen } from "../utils/coords";
import { DEFAULT_FONT } from "../utils/textLayout";
import {
  SIDES,
  anchorPoint,
  connectorShape,
  hitObject,
  nearestSide,
} from "../utils/connectors";
import type { BoardObject, ConnEnd, Connector, Side, TextObject } from "../types";
import SelectionToolbar from "./SelectionToolbar";
import type { ScreenRect } from "./SelectionToolbar";
import ConnectorToolbar from "./ConnectorToolbar";
import TextEditor from "./TextEditor";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const BASE_GAP = 24; // spacing between dots in world units
const HIT_MARGIN = 14; // screen px around an object that still counts as a hit

// Konva can't read CSS variables, so canvas colors live here
const CANVAS_COLORS = {
  light: {
    text: "#2a1f36",
    select: "#8b5cf6",
    outline: "#2a1f36",
    anchorFill: "#ffffff",
  },
  dark: {
    text: "#f3eaff",
    select: "#a78bfa",
    outline: "#f3eaff",
    anchorFill: "#241c30",
  },
};

type Box = { x: number; y: number; width: number; height: number };
type Pos = { x: number; y: number };
type AnchorTarget = { id: string; side: Side } | null;

// a connector being drawn, or having one of its ends dragged
type Draft =
  | { mode: "new"; from: ConnEnd; to: ConnEnd; sx: number; sy: number }
  | { mode: "edit"; id: string; which: "from" | "to" };

// topmost shape that contains the world point
function findShapeAt(
  px: number,
  py: number,
  objs: Record<string, BoardObject>,
  pos: Record<string, Pos>
) {
  const list = Object.values(objs);
  for (let i = list.length - 1; i >= 0; i--) {
    const o = list[i];
    if (o.type !== "shape") continue;
    const p = pos[o.id] ?? { x: o.x, y: o.y };
    if (
      pointInRect(px, py, {
        x: p.x,
        y: p.y,
        width: o.width,
        height: o.height,
        rotation: o.rotation,
      })
    ) {
      return o;
    }
  }
  return null;
}

export default function Board() {
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Node>>({});
  const dragStart = useRef<Record<string, Pos>>({});
  const dragRoots = useRef<string[]>([]);
  const draftRef = useRef<Draft | null>(null);
  const marqueeRef = useRef<{ x1: number; y1: number; base: string[] } | null>(
    null
  );

  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [spaceDown, setSpaceDown] = useState(false);
  const [interacting, setInteracting] = useState(false); // dragging or resizing
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [livePos, setLivePos] = useState<Record<string, Pos> | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [anchorTarget, setAnchorTarget] = useState<AnchorTarget>(null);

  const objects = useBoard((s) => s.objects);
  const connectors = useBoard((s) => s.connectors);
  const viewport = useBoard((s) => s.viewport);
  const setViewport = useBoard((s) => s.setViewport);
  const updateObjects = useBoard((s) => s.updateObjects);
  const select = useBoard((s) => s.select);
  const selectedIds = useBoard((s) => s.selectedIds);
  const selectedConnectorId = useBoard((s) => s.selectedConnectorId);
  const editingId = useBoard((s) => s.editingId);
  const tool = useBoard((s) => s.tool);
  const theme = useBoard((s) => s.theme);

  const colors = CANVAS_COLORS[theme];
  const panMode = tool === "hand" || spaceDown;

  // objects with the positions they have *right now* while being dragged,
  // so connectors follow live
  const liveObjects: Record<string, BoardObject> = livePos
    ? Object.fromEntries(
        Object.entries(objects).map(([id, o]): [string, BoardObject] => [
          id,
          livePos[id] ? ({ ...o, ...livePos[id] } as BoardObject) : o,
        ])
      )
    : objects;

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // keyboard: Space = pan, Delete, Esc, Ctrl+A, V / H / C tools
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return (
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const st = useBoard.getState();

      if (e.code === "Space") {
        e.preventDefault();
        setSpaceDown(true);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (st.selectedConnectorId) st.deleteConnector(st.selectedConnectorId);
        else if (st.selectedIds.length) st.deleteObjects(st.selectedIds);
      } else if (e.key === "Escape") {
        st.select([]);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        st.select(Object.keys(st.objects));
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key.toLowerCase() === "v") st.setTool("select");
        if (e.key.toLowerCase() === "h") st.setTool("hand");
        if (e.key.toLowerCase() === "c") st.setTool("connector");
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // attach the resize/rotate handles to the selected nodes
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const nodes =
      tool === "select" && !editingId
        ? selectedIds.map((id) => nodeRefs.current[id]).filter(Boolean)
        : [];
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, objects, tool, editingId]);

  // selection box (marquee): follow the mouse until it is released
  const marqueeOn = marquee !== null;
  useEffect(() => {
    if (!marqueeOn) return;

    const onMove = (e: MouseEvent) => {
      const s = marqueeRef.current;
      if (!s) return;
      const box: Box = {
        x: Math.min(s.x1, e.clientX),
        y: Math.min(s.y1, e.clientY),
        width: Math.abs(e.clientX - s.x1),
        height: Math.abs(e.clientY - s.y1),
      };
      setMarquee(box);

      const hit: string[] = [];
      for (const [id, node] of Object.entries(nodeRefs.current)) {
        if (Konva.Util.haveIntersection(box, node.getClientRect())) hit.push(id);
      }
      useBoard.getState().select(Array.from(new Set([...s.base, ...hit])));
    };

    const onUp = () => {
      marqueeRef.current = null;
      setMarquee(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [marqueeOn]);

  // connector drawing / end dragging: follow the mouse until it is released
  const draftOn = draft !== null;
  useEffect(() => {
    if (!draftOn) return;

    // what is under the mouse: an object side to attach to, or a free point
    const endAt = (
      e: MouseEvent,
      exclude?: string
    ): { end: ConnEnd; hover: AnchorTarget } => {
      const st = useBoard.getState();
      const w = screenToWorld(e.clientX, e.clientY, st.viewport);
      const target = hitObject(w.x, w.y, st.objects, HIT_MARGIN / st.viewport.zoom);
      if (target && target.id !== exclude) {
        const side = nearestSide(target, w.x, w.y);
        return {
          end: { objectId: target.id, side },
          hover: { id: target.id, side },
        };
      }
      return { end: { x: w.x, y: w.y }, hover: null };
    };

    const onMove = (e: MouseEvent) => {
      const d = draftRef.current;
      if (!d) return;

      if (d.mode === "new") {
        const exclude = "objectId" in d.from ? d.from.objectId : undefined;
        const r = endAt(e, exclude);
        const next: Draft = { ...d, to: r.end };
        draftRef.current = next;
        setDraft(next);
        setAnchorTarget(r.hover);
      } else {
        const st = useBoard.getState();
        const c = st.connectors[d.id];
        if (!c) return;
        const other = d.which === "from" ? c.to : c.from;
        const exclude = "objectId" in other ? other.objectId : undefined;
        const r = endAt(e, exclude);
        st.updateConnector(d.id, d.which === "from" ? { from: r.end } : { to: r.end });
        setAnchorTarget(r.hover);
      }
    };

    const onUp = (e: MouseEvent) => {
      const d = draftRef.current;
      if (d && d.mode === "new") {
        const moved = Math.hypot(e.clientX - d.sx, e.clientY - d.sy);
        if (moved > 6) {
          const st = useBoard.getState();
          const id = crypto.randomUUID();
          st.addConnector({
            id,
            from: d.from,
            to: d.to,
            style: "straight",
            arrowStart: false,
            arrowEnd: true,
            dashed: false,
          });
          st.selectConnector(id);
          st.setTool("select");
        }
      }
      draftRef.current = null;
      setDraft(null);
      setAnchorTarget(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draftOn]);

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current!;
    const pointer = stage.getPointerPosition()!;
    const oldZoom = viewport.zoom;

    const worldX = (pointer.x - viewport.x) / oldZoom;
    const worldY = (pointer.y - viewport.y) / oldZoom;

    const factor = e.evt.deltaY > 0 ? 1 / 1.1 : 1.1;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * factor));

    setViewport({
      zoom: newZoom,
      x: pointer.x - worldX * newZoom,
      y: pointer.y - worldY * newZoom,
    });
  };

  // ----- node interaction -----

  const onNodeDown = (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool !== "select") return;
    e.cancelBubble = true; // don't start a selection box
    const cur = useBoard.getState().selectedIds;
    if (e.evt.shiftKey) {
      select(cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id]);
    } else if (!cur.includes(id)) {
      select([id]);
    }
  };

  // double-click: edit a text, or type text into a shape
  const onNodeDblClick = (id: string) => {
    if (tool !== "select") return;
    const st = useBoard.getState();
    const o = st.objects[id];
    if (!o) return;

    if (o.type === "text") {
      st.select([id]);
      st.setEditing(id);
      return;
    }

    const child = Object.values(st.objects).find(
      (t) => t.type === "text" && t.parentId === id
    );
    if (child) {
      st.select([child.id]);
      st.setEditing(child.id);
      return;
    }

    const tid = crypto.randomUUID();
    st.addObject({
      id: tid,
      type: "text",
      parentId: id,
      text: "",
      fontSize: 24,
      fontFamily: DEFAULT_FONT,
      x: 0,
      y: 0,
      width: 100,
      height: 30,
      rotation: 0,
    });
    st.select([tid]);
    st.setEditing(tid);
  };

  const commitEdit = (id: string, value: string) => {
    const st = useBoard.getState();
    if (st.editingId !== id) return;
    st.setEditing(null);
    if (value.trim() === "") {
      st.deleteObjects([id]);
      return;
    }
    st.updateObjects({ [id]: { text: value } });
  };

  // remember where every moving object started, so they all move together
  // (text snapped into a dragged shape comes along with it)
  const onNodeDragStart = (id: string) => {
    const st = useBoard.getState();
    const roots = st.selectedIds.includes(id) ? st.selectedIds : [id];
    dragRoots.current = roots;

    const all = new Set(roots);
    for (const o of Object.values(st.objects)) {
      if (o.type === "text" && o.parentId && roots.includes(o.parentId)) {
        all.add(o.id);
      }
    }

    const start: Record<string, Pos> = {};
    for (const i of all) {
      if (st.objects[i]) start[i] = { x: st.objects[i].x, y: st.objects[i].y };
    }
    dragStart.current = start;
    setInteracting(true);
  };

  const onNodeDragMove = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const origin = dragStart.current[id];
    if (!origin) return;
    const dx = e.target.x() - origin.x;
    const dy = e.target.y() - origin.y;

    const live: Record<string, Pos> = { [id]: { x: e.target.x(), y: e.target.y() } };
    for (const [other, p] of Object.entries(dragStart.current)) {
      if (other === id) continue;
      const np = { x: p.x + dx, y: p.y + dy };
      nodeRefs.current[other]?.position(np);
      live[other] = np;
    }
    setLivePos(live); // lets connectors follow while dragging
  };

  const onNodeDragEnd = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const origin = dragStart.current[id];
    if (origin) {
      const st = useBoard.getState();
      const dx = e.target.x() - origin.x;
      const dy = e.target.y() - origin.y;

      const pos: Record<string, Pos> = {};
      const patches: Record<string, Partial<BoardObject>> = {};
      for (const [other, p] of Object.entries(dragStart.current)) {
        pos[other] = { x: p.x + dx, y: p.y + dy };
        patches[other] = pos[other];
      }

      // dropped text snaps into the shape under it, or detaches if there is none
      for (const rid of dragRoots.current) {
        const o = st.objects[rid];
        if (!o || o.type !== "text") continue;
        if (o.parentId && dragRoots.current.includes(o.parentId)) continue; // moving with its shape

        const b = objectBounds({ ...o, ...pos[rid] });
        const target = findShapeAt(
          (b.minX + b.maxX) / 2,
          (b.minY + b.maxY) / 2,
          st.objects,
          pos
        );
        const tp: Partial<TextObject> = { ...pos[rid], parentId: target?.id };
        patches[rid] = tp;
      }

      updateObjects(patches);
    }
    dragStart.current = {};
    dragRoots.current = [];
    setLivePos(null);
    setInteracting(false);
  };

  // after resizing, turn the scale back into real width/height
  const onNodeTransformEnd = (id: string, e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const obj = useBoard.getState().objects[id];
    if (!obj) return;

    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    if (obj.type === "shape") {
      updateObjects({
        [id]: {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: Math.max(20, obj.width * sx),
          height: Math.max(20, obj.height * sy),
        },
      });
    } else {
      updateObjects({
        [id]: {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: Math.max(20, obj.width * sx),
          fontSize: Math.max(8, obj.fontSize * sy),
        },
      });
    }
    setInteracting(false);
  };

  const setRef = (id: string) => (node: Konva.Node | null) => {
    if (node) nodeRefs.current[id] = node;
    else delete nodeRefs.current[id];
  };

  // ----- connectors -----

  const renderConnector = (
    c: Connector,
    opts: { selected: boolean; preview: boolean }
  ) => {
    const shape = connectorShape(c, liveObjects);
    if (!shape) return null;
    const color = c.color ?? colors.text;

    return (
      <Group
        key={c.id}
        opacity={opts.preview ? 0.7 : 1}
        listening={!opts.preview && tool === "select"}
        onMouseDown={(e) => {
          e.cancelBubble = true; // don't start a selection box
          useBoard.getState().selectConnector(c.id);
        }}
      >
        {opts.selected && (
          <Path
            data={shape.d}
            stroke={colors.select}
            strokeWidth={8}
            opacity={0.25}
            lineCap="round"
            listening={false}
          />
        )}
        <Path
          data={shape.d}
          stroke={color}
          strokeWidth={2.5}
          lineCap="round"
          dash={c.dashed ? [8, 6] : undefined}
          hitStrokeWidth={16}
        />
        {shape.startHead && (
          <Line
            points={shape.startHead}
            closed
            fill={color}
            stroke={color}
            strokeWidth={1}
            lineJoin="round"
          />
        )}
        {shape.endHead && (
          <Line
            points={shape.endHead}
            closed
            fill={color}
            stroke={color}
            strokeWidth={1}
            lineJoin="round"
          />
        )}
      </Group>
    );
  };

  const previewConn: Connector | null =
    draft && draft.mode === "new"
      ? {
          id: "draft",
          from: draft.from,
          to: draft.to,
          style: "straight",
          arrowStart: false,
          arrowEnd: true,
          dashed: false,
        }
      : null;

  const anchorObj = anchorTarget ? liveObjects[anchorTarget.id] : undefined;

  const selConn = selectedConnectorId ? connectors[selectedConnectorId] : undefined;
  const selConnShape = selConn ? connectorShape(selConn, liveObjects) : null;
  const showConnOverlays = !!selConn && !!selConnShape && tool === "select" && !draft;

  let connRect: ScreenRect | null = null;
  if (selConnShape) {
    const b = selConnShape.bbox;
    const p = worldToScreen(b.minX, b.minY, viewport);
    connRect = {
      x: p.x,
      y: p.y,
      width: (b.maxX - b.minX) * viewport.zoom,
      height: (b.maxY - b.minY) * viewport.zoom,
    };
  }

  // ----- selection bounds in screen space (for the popup and size label) -----

  let selRect: ScreenRect | null = null;
  let selWorldW = 0;
  let selWorldH = 0;
  if (tool === "select" && selectedIds.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of selectedIds) {
      const o = objects[id];
      if (!o) continue;
      const b = objectBounds(o);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }
    if (minX !== Infinity) {
      const p = worldToScreen(minX, minY, viewport);
      selWorldW = maxX - minX;
      selWorldH = maxY - minY;
      selRect = {
        x: p.x,
        y: p.y,
        width: selWorldW * viewport.zoom,
        height: selWorldH * viewport.zoom,
      };
    }
  }
  const showOverlays = selRect !== null && !marquee && !interacting && !editingId;

  // shapes first, text on top of them
  const list = Object.values(objects);
  const ordered = [
    ...list.filter((o) => o.type === "shape"),
    ...list.filter((o) => o.type === "text"),
  ];

  const editingObj = editingId ? objects[editingId] : undefined;

  // Dot grid that follows pan/zoom
  let gap = BASE_GAP;
  while (gap * viewport.zoom < 14) gap *= 2; // wider spacing when zoomed far out
  const step = gap * viewport.zoom;
  const dotR = Math.max(1, 1.3 * Math.min(viewport.zoom, 1.5));

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "var(--bg)",
        backgroundImage: `radial-gradient(circle, var(--dot) ${dotR}px, transparent ${dotR}px)`,
        backgroundSize: `${step}px ${step}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        cursor: panMode ? "grab" : tool === "connector" ? "crosshair" : "default",
      }}
    >
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.zoom}
        scaleY={viewport.zoom}
        draggable={panMode}
        onWheel={handleWheel}
        onDragMove={(e) => {
          // update during the drag so the dots move with the board
          if (e.target === stageRef.current) {
            setViewport({ ...viewport, x: e.target.x(), y: e.target.y() });
          }
        }}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) {
            setViewport({ ...viewport, x: e.target.x(), y: e.target.y() });
          }
        }}
        onMouseMove={(e) => {
          // connector tool: show the anchor dots of the object under the mouse
          if (tool !== "connector" || draftRef.current || spaceDown) return;
          const w = screenToWorld(e.evt.clientX, e.evt.clientY, viewport);
          const t = hitObject(w.x, w.y, objects, HIT_MARGIN / viewport.zoom);
          const next: AnchorTarget = t
            ? { id: t.id, side: nearestSide(t, w.x, w.y) }
            : null;
          setAnchorTarget((prev) =>
            prev?.id === next?.id && prev?.side === next?.side ? prev : next
          );
        }}
        onMouseDown={(e) => {
          // connector tool: start drawing a connector
          if (tool === "connector" && !spaceDown) {
            if (e.evt.button !== 0) return;
            const w = screenToWorld(e.evt.clientX, e.evt.clientY, viewport);
            const target = hitObject(w.x, w.y, objects, HIT_MARGIN / viewport.zoom);
            const from: ConnEnd = target
              ? { objectId: target.id, side: nearestSide(target, w.x, w.y) }
              : { x: w.x, y: w.y };
            const d: Draft = {
              mode: "new",
              from,
              to: { x: w.x, y: w.y },
              sx: e.evt.clientX,
              sy: e.evt.clientY,
            };
            draftRef.current = d;
            setDraft(d);
            return;
          }

          // empty space + Select tool = start a selection box
          if (e.target !== stageRef.current) return;
          if (tool !== "select" || spaceDown) return;
          const shift = e.evt.shiftKey;
          const base = shift ? useBoard.getState().selectedIds : [];
          if (!shift) select([]);
          marqueeRef.current = { x1: e.evt.clientX, y1: e.evt.clientY, base };
          setMarquee({ x: e.evt.clientX, y: e.evt.clientY, width: 0, height: 0 });
        }}
      >
        <Layer>
          {ordered.map((obj) => {
            const common = {
              x: obj.x,
              y: obj.y,
              rotation: obj.rotation,
              draggable: tool === "select",
              ref: setRef(obj.id),
              onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) =>
                onNodeDown(obj.id, e),
              onDblClick: () => onNodeDblClick(obj.id),
              onDblTap: () => onNodeDblClick(obj.id),
              onDragStart: () => onNodeDragStart(obj.id),
              onDragMove: (e: Konva.KonvaEventObject<DragEvent>) =>
                onNodeDragMove(obj.id, e),
              onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
                onNodeDragEnd(obj.id, e),
              onTransformStart: () => setInteracting(true),
              onTransformEnd: (e: Konva.KonvaEventObject<Event>) =>
                onNodeTransformEnd(obj.id, e),
            };

            if (obj.type === "shape") {
              return (
                <Path
                  key={obj.id}
                  {...common}
                  data={shapePath(obj.shape, obj.width, obj.height)}
                  fill={obj.fill}
                  stroke={colors.outline}
                  strokeWidth={1.5}
                  strokeScaleEnabled={false}
                  lineJoin="round"
                />
              );
            }
            return (
              <Text
                key={obj.id}
                {...common}
                visible={editingId !== obj.id}
                text={obj.text}
                fontSize={obj.fontSize}
                fontFamily={obj.fontFamily}
                width={obj.width}
                align={obj.parentId ? "center" : "left"}
                fill={obj.color ?? colors.text}
              />
            );
          })}

          {/* connectors */}
          {Object.values(connectors).map((c) =>
            renderConnector(c, {
              selected: c.id === selectedConnectorId,
              preview: false,
            })
          )}
          {previewConn && renderConnector(previewConn, { selected: false, preview: true })}

          {/* anchor dots on the object the connector would attach to */}
          {(tool === "connector" || draft) &&
            anchorTarget &&
            anchorObj &&
            SIDES.map((side) => {
              const p = anchorPoint(anchorObj, side);
              const active = side === anchorTarget.side;
              return (
                <Circle
                  key={side}
                  x={p.x}
                  y={p.y}
                  radius={(active ? 7 : 5) / viewport.zoom}
                  fill={active ? colors.select : colors.anchorFill}
                  stroke={colors.select}
                  strokeWidth={1.5 / viewport.zoom}
                  listening={false}
                />
              );
            })}

          <Transformer
            ref={trRef}
            keepRatio={false}
            shiftBehavior="inverted"
            flipEnabled={false}
            ignoreStroke
            rotateEnabled
            anchorSize={10}
            anchorCornerRadius={2}
            anchorStroke={colors.select}
            anchorFill={colors.anchorFill}
            borderStroke={colors.select}
            borderStrokeWidth={1.5}
            rotateAnchorOffset={24}
            boundBoxFunc={(oldBox, newBox) =>
              newBox.width < 20 || newBox.height < 20 ? oldBox : newBox
            }
          />
        </Layer>
      </Stage>

      {/* selection box */}
      {marquee && (
        <div
          style={{
            position: "fixed",
            left: marquee.x,
            top: marquee.y,
            width: marquee.width,
            height: marquee.height,
            border: "1px solid var(--primary)",
            background: "rgba(139, 92, 246, 0.1)",
            pointerEvents: "none",
            zIndex: 5,
          }}
        />
      )}

      {/* floating popup above the selection */}
      {showOverlays && selRect && <SelectionToolbar rect={selRect} />}

      {/* size label under the selection */}
      {showOverlays && selRect && (
        <div
          style={{
            position: "fixed",
            left: selRect.x + selRect.width / 2,
            top: selRect.y + selRect.height + 12,
            transform: "translateX(-50%)",
            padding: "2px 8px",
            borderRadius: 6,
            background: "var(--primary)",
            color: "#ffffff",
            fontSize: 12,
            fontWeight: 600,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 5,
          }}
        >
          {Math.round(selWorldW)} × {Math.round(selWorldH)}
        </div>
      )}

      {/* popup for a selected connector */}
      {showConnOverlays && selConn && connRect && (
        <ConnectorToolbar connector={selConn} rect={connRect} />
      )}

      {/* drag handles on both ends of a selected connector */}
      {showConnOverlays &&
        selConn &&
        selConnShape &&
        (["from", "to"] as const).map((which) => {
          const wp = which === "from" ? selConnShape.p0 : selConnShape.p3;
          const sp = worldToScreen(wp.x, wp.y, viewport);
          return (
            <div
              key={which}
              title="Drag to reconnect"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const d: Draft = { mode: "edit", id: selConn.id, which };
                draftRef.current = d;
                setDraft(d);
              }}
              style={{
                position: "fixed",
                left: sp.x - 7,
                top: sp.y - 7,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "var(--surface)",
                border: "2px solid var(--primary)",
                cursor: "grab",
                zIndex: 6,
              }}
            />
          );
        })}

      {/* in-place text editing */}
      {editingObj && editingObj.type === "text" && (
        <TextEditor
          key={editingObj.id}
          obj={editingObj}
          viewport={viewport}
          color={editingObj.color ?? colors.text}
          onCommit={(value) => commitEdit(editingObj.id, value)}
        />
      )}
    </div>
  );
}