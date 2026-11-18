import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  BoardObject,
  Connector,
  ShapeObject,
  Viewport,
  Tool,
  Theme,
} from "./types";
import { layoutAttached, measureHeight } from "./utils/textLayout";
import { anchorPoint } from "./utils/connectors";

const getInitialTheme = (): Theme => {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // storage unavailable, fall through to system preference
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

// Keeps text sizes right: free text gets its real height, text snapped into a
// shape is re-centered and re-fitted, and shapes re-fit the text inside them.
function relayout(objects: Record<string, BoardObject>, ids: string[]) {
  const shapeIds = new Set<string>();

  for (const id of ids) {
    const o = objects[id];
    if (!o) continue;
    if (o.type === "shape") {
      shapeIds.add(id);
    } else {
      const parent = o.parentId ? objects[o.parentId] : undefined;
      if (parent && parent.type === "shape") {
        layoutAttached(o, parent);
      } else {
        o.parentId = undefined;
        o.height = measureHeight(o.text, o.fontSize, o.fontFamily, o.width);
      }
    }
  }

  if (shapeIds.size > 0) {
    for (const o of Object.values(objects)) {
      if (o.type === "text" && o.parentId && shapeIds.has(o.parentId)) {
        layoutAttached(o, objects[o.parentId] as ShapeObject);
      }
    }
  }
}

export type BoardContent = {
  objects: Record<string, BoardObject>;
  connectors: Record<string, Connector>;
  viewport: Viewport;
};

type BoardState = {
  objects: Record<string, BoardObject>;
  connectors: Record<string, Connector>;
  viewport: Viewport;
  selectedIds: string[];
  selectedConnectorId: string | null;
  editingId: string | null;
  tool: Tool;
  theme: Theme;
  

  addObject: (obj: BoardObject) => void;
  updateObject: (id: string, patch: Partial<BoardObject>) => void;
  updateObjects: (patches: Record<string, Partial<BoardObject>>) => void;
  deleteObjects: (ids: string[]) => void;
  addConnector: (c: Connector) => void;
  updateConnector: (id: string, patch: Partial<Connector>) => void;
  deleteConnector: (id: string) => void;
  selectConnector: (id: string | null) => void;
  setViewport: (v: Viewport) => void;
  select: (ids: string[]) => void;
  setEditing: (id: string | null) => void;
  setTool: (t: Tool) => void;
  toggleTheme: () => void;
  setBoard: (content: BoardContent) => void; // open a saved board
  resetBoard: () => void; // empty the board (when leaving it)

};

export const useBoard = create<BoardState>()(
  immer((set) => ({
    objects: {},
    connectors: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedIds: [],
    selectedConnectorId: null,
    editingId: null,
    tool: "select",
    theme: getInitialTheme(),

    addObject: (obj) =>
      set((s) => {
        s.objects[obj.id] = obj;
        relayout(s.objects, [obj.id]);
      }),

    updateObject: (id, patch) =>
      set((s) => {
        if (s.objects[id]) {
          Object.assign(s.objects[id], patch);
          relayout(s.objects, [id]);
        }
      }),

    // update many objects in one step (move/resize/color of a multi-selection)
    updateObjects: (patches) =>
      set((s) => {
        const ids = Object.keys(patches);
        for (const id of ids) {
          if (s.objects[id]) Object.assign(s.objects[id], patches[id]);
        }
        relayout(s.objects, ids);
      }),

    deleteObjects: (ids) =>
      set((s) => {
        // connectors attached to a deleted object keep that end where it was
        for (const c of Object.values(s.connectors)) {
          for (const key of ["from", "to"] as const) {
            const e = c[key];
            if ("objectId" in e && ids.includes(e.objectId)) {
              const o = s.objects[e.objectId];
              c[key] = o ? anchorPoint(o, e.side) : { x: 0, y: 0 };
            }
          }
        }

        for (const id of ids) delete s.objects[id];
        // text that was snapped into a deleted shape becomes free text again
        for (const o of Object.values(s.objects)) {
          if (o.type === "text" && o.parentId && !s.objects[o.parentId]) {
            o.parentId = undefined;
          }
        }
        s.selectedIds = s.selectedIds.filter((i) => !ids.includes(i));
        if (s.editingId && ids.includes(s.editingId)) s.editingId = null;
      }),

    addConnector: (c) =>
      set((s) => {
        s.connectors[c.id] = c;
      }),

    updateConnector: (id, patch) =>
      set((s) => {
        if (s.connectors[id]) Object.assign(s.connectors[id], patch);
      }),

    deleteConnector: (id) =>
      set((s) => {
        delete s.connectors[id];
        if (s.selectedConnectorId === id) s.selectedConnectorId = null;
      }),

    // selecting a connector clears the object selection (and the other way round)
    selectConnector: (id) =>
      set((s) => {
        s.selectedConnectorId = id;
        s.selectedIds = [];
      }),

    setViewport: (v) =>
      set((s) => {
        s.viewport = v;
      }),

    select: (ids) =>
      set((s) => {
        s.selectedIds = ids;
        s.selectedConnectorId = null;
      }),

    setEditing: (id) =>
      set((s) => {
        s.editingId = id;
      }),

    setTool: (t) =>
      set((s) => {
        s.tool = t;
      }),

    toggleTheme: () =>
      set((s) => {
        s.theme = s.theme === "light" ? "dark" : "light";
      }),

    setBoard: (content) =>
      set((s) => {
        s.objects = content.objects;
        s.connectors = content.connectors;
        s.viewport = content.viewport;
        s.selectedIds = [];
        s.selectedConnectorId = null;
        s.editingId = null;
        s.tool = "select";
      }),

    resetBoard: () =>
      set((s) => {
        s.objects = {};
        s.connectors = {};
        s.viewport = { x: 0, y: 0, zoom: 1 };
        s.selectedIds = [];
        s.selectedConnectorId = null;
        s.editingId = null;
        s.tool = "select";
      }),
  }))
);