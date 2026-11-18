export type Viewport = { x: number; y: number; zoom: number };

export type Tool = "select" | "hand" | "connector";

export type Theme = "light" | "dark";

export type ShapeKind =
  | "square"
  | "rounded"
  | "circle"
  | "diamond"
  | "triangle"
  | "invTriangle"
  | "parallelogramR"
  | "parallelogramL"
  | "trapezoid"
  | "pentagon"
  | "hexagon"
  | "octagon"
  | "star"
  | "plus"
  | "arrowLeft"
  | "arrowRight"
  | "chevron"
  | "speech"
  | "cylinder"
  | "document"
  | "process"
  | "slanted"
  | "frame";

type BaseObject = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type ShapeObject = BaseObject & {
  type: "shape";
  shape: ShapeKind;
  fill: string;
};

export type TextObject = BaseObject & {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  color?: string; // undefined = follows the light/dark theme
  parentId?: string; // id of the shape this text is snapped into
};

export type BoardObject = ShapeObject | TextObject;

// ----- connectors -----

export type Side = "top" | "right" | "bottom" | "left";

// one end of a connector: attached to a side of an object, or a free point
export type ConnEnd = { objectId: string; side: Side } | { x: number; y: number };

export type Connector = {
  id: string;
  from: ConnEnd;
  to: ConnEnd;
  style: "straight" | "curved";
  arrowStart: boolean;
  arrowEnd: boolean;
  dashed: boolean;
  color?: string; // undefined = follows the light/dark theme
};