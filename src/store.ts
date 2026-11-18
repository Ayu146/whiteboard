import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { current } from "immer";
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
// Images need no layout, so they are skipped.
function relayout(objects: Record<string, BoardObject>, ids: string[]) {
  const shapeIds = new Set<string>();

  for (const id of ids) {
    const o = objects[id];
    if (!o) continue;
    if (o.type === "shape") {
      shapeIds.add(id);
    } else if (o.type === "text") {
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

// everything that makes up one saved board
export type BoardContent = {
  objects: Record<string, BoardObject>;
  connectors: Record<string, Connector>;
  viewport: Viewport;
};

// what undo/redo remembers
type Snapshot = {
  objects: Record<string, BoardObject>;
  connectors: Record<string, Connector>;
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

  past: Snapshot[]; // states you can undo back to
  future: Snapshot[]; // states you can redo to

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
  undo: () => void;
  redo: () => void;
  setBoard: (content: BoardContent) => void; // open a saved board
  resetBoard: () => void; // empty the board (when leaving it)
};

const MAX_HISTORY = 100;
const GROUP_MS = 500; // changes closer together than this are one undo step
let lastChange = 0;

// call at the start of every change to objects/connectors
function record(s: BoardState) {
  const now = Date.now();
  const startsNewStep = now - lastChange > GROUP_MS;
  lastChange = now;
  if (!startsNewStep) return;
  s.past.push({
    objects: current(s.objects),
    connectors: current(s.connectors),
  });
  if (s.past.length > MAX_HISTORY) s.past.shift();
  s.future = [];
}

export const useBoard = create<BoardState>()(
  immer((set, get) => ({
    objects: {},
    connectors: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedIds: [],
    selectedConnectorId: null,
    editingId: null,
    tool: "select",
    theme: getInitialTheme(),
    past: [],
    future: [],

    addObject: (obj) =>
      set((s) => {
        record(s);
        s.objects[obj.id] = obj;
        relayout(s.objects, [obj.id]);
      }),

    updateObject: (id, patch) =>
      set((s) => {
        if (s.objects[id]) {
          record(s);
          Object.assign(s.objects[id], patch);
          relayout(s.objects, [id]);
        }
      }),

    // update many objects in one step (move/resize/color of a multi-selection)
    updateObjects: (patches) =>
      set((s) => {
        record(s);
        const ids = Object.keys(patches);
        for (const id of ids) {
          if (s.objects[id]) Object.assign(s.objects[id], patches[id]);
        }
        relayout(s.objects, ids);
      }),

    deleteObjects: (ids) =>
      set((s) => {
        record(s);
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
        record(s);
        s.connectors[c.id] = c;
      }),

    updateConnector: (id, patch) =>
      set((s) => {
        if (s.connectors[id]) {
          record(s);
          Object.assign(s.connectors[id], patch);
        }
      }),

    deleteConnector: (id) =>
      set((s) => {
        record(s);
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

    undo: () => {
      const st = get();
      const prev = st.past[st.past.length - 1];
      if (!prev) return;
      const now: Snapshot = { objects: st.objects, connectors: st.connectors };
      lastChange = 0;
      set((s) => {
        s.past.pop();
        s.future.push(now);
        s.objects = prev.objects;
        s.connectors = prev.connectors;
        s.selectedIds = [];
        s.selectedConnectorId = null;
        s.editingId = null;
      });
    },

    redo: () => {
      const st = get();
      const next = st.future[st.future.length - 1];
      if (!next) return;
      const now: Snapshot = { objects: st.objects, connectors: st.connectors };
      lastChange = 0;
      set((s) => {
        s.future.pop();
        s.past.push(now);
        s.objects = next.objects;
        s.connectors = next.connectors;
        s.selectedIds = [];
        s.selectedConnectorId = null;
        s.editingId = null;
      });
    },

    setBoard: (content) => {
      lastChange = 0;
      set((s) => {
        s.objects = content.objects;
        s.connectors = content.connectors;
        s.viewport = content.viewport;
        s.selectedIds = [];
        s.selectedConnectorId = null;
        s.editingId = null;
        s.tool = "select";
        s.past = [];
        s.future = [];
      });
    },

    resetBoard: () => {
      lastChange = 0;
      set((s) => {
        s.objects = {};
        s.connectors = {};
        s.viewport = { x: 0, y: 0, zoom: 1 };
        s.selectedIds = [];
        s.selectedConnectorId = null;
        s.editingId = null;
        s.tool = "select";
        s.past = [];
        s.future = [];
      });
    },
  }))
);