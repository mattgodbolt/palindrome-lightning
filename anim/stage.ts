/**
 * Stage: a thin, reusable wrapper over an SVG element that knows how to draw
 * the handful of primitives our diagrams are made of - boxes, labels, whole
 * "nodes" (a box plus a centred label, i.e. a component), edges (a path between
 * two nodes) and tokens (a dot that can ride along an edge).
 *
 * It is deliberately render-only: it creates DOM and hands back element handles.
 * It does NOT animate anything - that is the timeline's job (see timeline.ts).
 * Keeping creation and animation separate is what makes the whole thing
 * seekable: every element a step might touch is created up front, and the
 * timeline only ever tweens properties of those existing elements.
 *
 * Everything lives in an SVG so it inherits the slide's CSS/LESS theme exactly
 * like HTML would (fill, stroke, font, custom properties), while still giving us
 * real vector geometry (paths, arrows, motion along a curve) that plain HTML
 * cannot do.
 */

const SVGNS = "http://www.w3.org/2000/svg";

/** A 2-D point in the SVG's user coordinate space. */
export interface Point {
  x: number;
  y: number;
}

/** The side an edge may leave or enter a box on. */
export type Side = "top" | "bottom" | "left" | "right" | "centre";

/** Per-side connection points for edge routing. */
export type Anchor = Record<Side, Point>;

/** A node or cluster: a box with a title. */
export interface BoxHandle {
  id?: string;
  /** node or cluster */
  kind: "node" | "cluster";
  /** the <g>; the element activate() tweens */
  group: SVGGElement;
  /** alias of group */
  el: SVGGElement;
  rect: SVGRectElement;
  label: SVGTextElement;
  x: number;
  y: number;
  w: number;
  h: number;
  /** centre x */
  cx: number;
  /** centre y */
  cy: number;
  /** per-side connection points for edge routing */
  anchor: Anchor;
}

/** A plain rectangle. */
export interface RectHandle {
  id?: string;
  kind: "box";
  el: SVGRectElement;
  rect: SVGRectElement;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

/** A free-form SVG path (waveforms, beams, curves). */
export interface PathHandle {
  id?: string;
  kind: "path";
  el: SVGPathElement;
  path: SVGPathElement;
  length: () => number;
}

/** A text label. */
export interface LabelHandle {
  id?: string;
  kind: "label";
  el: SVGTextElement;
  x: number;
  y: number;
  setText: (s: string) => void;
}

/** A morphable text "cell": a stack of text layers, one of which is current. */
export interface ValueHandle {
  id?: string;
  kind: "value";
  group: SVGGElement;
  el: SVGGElement;
  x: number;
  y: number;
  /** the currently visible text layer */
  current: SVGTextElement;
  /** add a new (initially invisible) text on top and return it */
  push: (s: string) => SVGTextElement;
}

/** A (curved) path between points or box anchors. */
export interface EdgeHandle {
  id?: string;
  kind: "edge";
  /** alias of path */
  el: SVGPathElement;
  path: SVGPathElement;
  /** resolved start point */
  from: Point;
  /** resolved end point */
  to: Point;
  /** total path length */
  length: () => number;
  /** point at fraction t along the path */
  pointAt: (t: number) => DOMPoint;
}

/** A hidden dot/pill that rides edges. */
export interface TokenHandle {
  id?: string;
  kind: "token";
  /** the <g> that rides an edge */
  el: SVGGElement;
  r: number;
}

/** Any handle Stage can hand back and retrieve via `get(id)`. */
export type Handle =
  RectHandle | PathHandle | LabelHandle | ValueHandle | BoxHandle | EdgeHandle | TokenHandle;

/** An edge endpoint: either a box (routed via a side anchor) or a bare point. */
export type EdgeEnd = BoxHandle | Point;

type AttrValue = string | number | null | undefined;

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, AttrValue> = {},
  parent: Element | null = null,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    node.setAttribute(k, String(v));
  }
  if (parent) parent.appendChild(node);
  return node;
}

/** Whether an edge endpoint is a box (has side anchors) rather than a raw point. */
function hasAnchor(end: EdgeEnd): end is BoxHandle {
  return "anchor" in end;
}

interface BoxOpts {
  id?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rx?: number;
  className?: string;
  parent?: Element;
}

interface PathOpts {
  id?: string;
  d: string;
  className?: string;
  parent?: Element;
}

interface LabelOpts {
  id?: string;
  x: number;
  y: number;
  text: string;
  className?: string;
  anchor?: string;
  parent?: Element;
}

interface ValueOpts {
  id?: string;
  x: number;
  y: number;
  text?: string;
  className?: string;
  anchor?: string;
  parent?: Element;
}

interface NodeOpts {
  id?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  title?: string;
  className?: string;
  titleClass?: string;
}

interface ClusterOpts {
  id?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  className?: string;
  titleClass?: string;
}

interface EdgeOpts {
  id?: string;
  from: EdgeEnd;
  to: EdgeEnd;
  fromSide?: Side | "auto";
  toSide?: Side | "auto";
  curve?: number;
  className?: string;
  arrow?: boolean;
  arrowStart?: boolean;
}

interface TokenOpts {
  id?: string;
  r?: number;
  text?: string;
  className?: string;
}

/** Elements created by node()/cluster() before the shared handle is assembled. */
interface BoxParts {
  id?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  group: SVGGElement;
  rect: SVGRectElement;
  label: SVGTextElement;
}

export class Stage {
  readonly svg: SVGSVGElement;
  private readonly byId = new Map<string, Handle>();
  readonly clusterLayer: SVGGElement;
  readonly edgeLayer: SVGGElement;
  readonly nodeLayer: SVGGElement;
  readonly tokenLayer: SVGGElement;

  /**
   * @param svg an <svg> with a sensible viewBox already set
   */
  constructor(svg: SVGSVGElement) {
    this.svg = svg;
    // Draw order (back to front): cluster containers under edges under nodes
    // under tokens, so grouping boxes sit behind everything, arrows behind
    // boxes, and travelling dots on top.
    this.clusterLayer = svgEl("g", { class: "layer-clusters" }, svg);
    this.edgeLayer = svgEl("g", { class: "layer-edges" }, svg);
    this.nodeLayer = svgEl("g", { class: "layer-nodes" }, svg);
    this.tokenLayer = svgEl("g", { class: "layer-tokens" }, svg);
  }

  private _register<T extends Handle>(id: string | undefined, handle: T): T {
    if (id) this.byId.set(id, handle);
    return handle;
  }

  get(id: string): Handle | undefined {
    return this.byId.get(id);
  }

  /** A plain rectangle. Returns { id, kind, rect, x, y, w, h, cx, cy }. */
  box({ id, x, y, w, h, rx = 8, className = "", parent = this.nodeLayer }: BoxOpts): RectHandle {
    const rect = svgEl(
      "rect",
      { x, y, width: w, height: h, rx, class: `box ${className}` },
      parent,
    );
    const handle: RectHandle = {
      id,
      kind: "box",
      el: rect,
      rect,
      x,
      y,
      w,
      h,
      cx: x + w / 2,
      cy: y + h / 2,
    };
    return this._register(id, handle);
  }

  /**
   * A free-form path from an SVG `d` string. Unlike edge() it has no endpoints
   * or arrowheads: use it for waveforms and other drawn curves, typically
   * revealed with Steps.draw().
   */
  path({ id, d, className = "", parent = this.nodeLayer }: PathOpts): PathHandle {
    const path = svgEl("path", { d, class: `path ${className}` }, parent);
    const handle: PathHandle = {
      id,
      kind: "path",
      el: path,
      path,
      length: () => path.getTotalLength(),
    };
    return this._register(id, handle);
  }

  /** A text label. `anchor` is the SVG text-anchor (start|middle|end). */
  label({
    id,
    x,
    y,
    text,
    className = "",
    anchor = "middle",
    parent = this.nodeLayer,
  }: LabelOpts): LabelHandle {
    const t = svgEl(
      "text",
      { x, y, "text-anchor": anchor, "dominant-baseline": "central", class: `label ${className}` },
      parent,
    );
    t.textContent = text;
    const handle: LabelHandle = {
      id,
      kind: "label",
      el: t,
      x,
      y,
      setText: (s: string) => {
        t.textContent = s;
      },
    };
    return this._register(id, handle);
  }

  /**
   * A morphable value: a stack of text elements at one spot, of which one is
   * "current". `push(text)` adds a new (initially invisible) text on top and
   * returns it; the timeline then cross-fades the old out and the new in. All
   * the historical layers stay in the DOM so a backward seek simply re-reveals
   * the previous one - no imperative textContent swaps, so it is fully
   * reversible. Used for RAT register values; equally a node's status text.
   */
  value({
    id,
    x,
    y,
    text = "",
    className = "",
    anchor = "middle",
    parent = this.nodeLayer,
  }: ValueOpts): ValueHandle {
    const group = svgEl("g", { class: `value ${className}`, "data-value": id }, parent);
    const mk = (s: string, opacity: number): SVGTextElement => {
      const t = svgEl(
        "text",
        {
          x,
          y,
          "text-anchor": anchor,
          "dominant-baseline": "central",
          class: "value-text",
          opacity,
        },
        group,
      );
      t.textContent = s;
      return t;
    };
    const handle: ValueHandle = {
      id,
      kind: "value",
      group,
      el: group,
      x,
      y,
      current: mk(text, 1),
      push(s: string): SVGTextElement {
        return mk(s, 0);
      },
    };
    return this._register(id, handle);
  }

  /**
   * A "node" = a box with a centred title. This is the unit a component diagram
   * is built from (an ALB, a backend, an S3 bucket...). Returns a handle whose
   * `.group` can be highlighted/moved and which exposes anchor points for edges.
   */
  node({
    id,
    x,
    y,
    w = 180,
    h = 64,
    title = "",
    className = "",
    titleClass = "",
  }: NodeOpts): BoxHandle {
    const group = svgEl("g", { class: `node ${className}`, "data-node": id }, this.nodeLayer);
    const rect = svgEl("rect", { x, y, width: w, height: h, rx: 10, class: "node-box" }, group);
    const label = svgEl(
      "text",
      {
        x: x + w / 2,
        y: y + h / 2,
        "text-anchor": "middle",
        "dominant-baseline": "central",
        class: `node-title ${titleClass}`,
      },
      group,
    );
    label.textContent = title;
    return this._boxHandle("node", { id, x, y, w, h, group, rect, label });
  }

  /**
   * A "cluster" = a titled container box that visually groups other nodes (e.g.
   * the serving fleet, or the storage tier). Same handle shape as node() so it
   * exposes anchors and can be activated, but drawn in the back layer so member
   * nodes sit on top. The title sits at the top-left inside the box.
   */
  cluster({ id, x, y, w, h, title = "", className = "", titleClass = "" }: ClusterOpts): BoxHandle {
    const group = svgEl(
      "g",
      { class: `cluster ${className}`, "data-cluster": id },
      this.clusterLayer,
    );
    const rect = svgEl("rect", { x, y, width: w, height: h, rx: 14, class: "cluster-box" }, group);
    const label = svgEl(
      "text",
      {
        x: x + 16,
        y: y + 22,
        "text-anchor": "start",
        "dominant-baseline": "central",
        class: `cluster-title ${titleClass}`,
      },
      group,
    );
    label.textContent = title;
    return this._boxHandle("cluster", { id, x, y, w, h, group, rect, label });
  }

  /**
   * Shared tail of node()/cluster(): both produce the same handle shape (group,
   * rect, label, geometry and per-side anchor points); only the DOM they create
   * differs. Given the created elements, assembles and registers the handle.
   */
  private _boxHandle(
    kind: "node" | "cluster",
    { id, x, y, w, h, group, rect, label }: BoxParts,
  ): BoxHandle {
    const handle: BoxHandle = {
      id,
      kind,
      group,
      el: group,
      rect,
      label,
      x,
      y,
      w,
      h,
      cx: x + w / 2,
      cy: y + h / 2,
      // Anchor points on each side, for edge routing.
      anchor: {
        top: { x: x + w / 2, y },
        bottom: { x: x + w / 2, y: y + h },
        left: { x, y: y + h / 2 },
        right: { x: x + w, y: y + h / 2 },
        centre: { x: x + w / 2, y: y + h / 2 },
      },
    };
    return this._register(id, handle);
  }

  /**
   * An edge between two points (or node anchors). Accepts either {x,y} points
   * or node handles via fromSide/toSide. With the default `"auto"`, the exit and
   * entry faces are inferred from the nodes' relative position (whichever axis
   * dominates), so a vertical stack connects bottom->top and a horizontal row
   * left->right without the caller specifying sides. `curve` bows the path so
   * parallel edges don't overlap; 0 = straight. Returns a handle with geometry
   * helpers (`length`, `pointAt`) used to fly tokens along it. `arrowStart` adds
   * a second arrowhead at the source for a bidirectional edge.
   */
  edge({
    id,
    from,
    to,
    fromSide = "auto",
    toSide = "auto",
    curve = 0,
    className = "",
    arrow = true,
    arrowStart = false,
  }: EdgeOpts): EdgeHandle {
    if (fromSide === "auto" || toSide === "auto") {
      const [f, t] = inferSides(from, to);
      if (fromSide === "auto") fromSide = f;
      if (toSide === "auto") toSide = t;
    }
    // Resolve an endpoint (a node/cluster handle or a bare point) to a point on
    // the requested side.
    const at = (end: EdgeEnd, side: Side): Point => (hasAnchor(end) ? end.anchor[side] : end);
    const a = at(from, fromSide);
    const b = at(to, toSide);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    // Control point offset perpendicular to the line, scaled by `curve`.
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const cxp = mx + nx * curve;
    const cyp = my + ny * curve;
    const d = `M ${a.x} ${a.y} Q ${cxp} ${cyp} ${b.x} ${b.y}`;
    const path = svgEl(
      "path",
      {
        d,
        class: `edge ${className}`,
        fill: "none",
        // The shared marker is orient:auto-start-reverse, so the same arrowhead
        // points "outward" whether used as marker-end or marker-start; that is
        // what makes a bidirectional edge (arrowStart) render correctly.
        "marker-end": arrow ? "url(#arrowhead)" : null,
        "marker-start": arrowStart ? "url(#arrowhead)" : null,
      },
      this.edgeLayer,
    );
    ensureArrowhead(this.svg);
    const handle: EdgeHandle = {
      id,
      kind: "edge",
      el: path,
      path,
      from: a,
      to: b,
      length: () => path.getTotalLength(),
      pointAt: (t: number) => path.getPointAtLength(path.getTotalLength() * t),
    };
    return this._register(id, handle);
  }

  /**
   * A token that rides edges: a small pill (optionally labelled) anchored at the
   * group origin so MotionPath can translate it along a path. Created hidden.
   */
  token({ id, r = 11, text = "", className = "" }: TokenOpts): TokenHandle {
    const group = svgEl("g", { class: `token ${className}`, opacity: 0 }, this.tokenLayer);
    if (text) {
      const w = Math.max(2 * r, 12 + text.length * 9);
      svgEl(
        "rect",
        { x: -w / 2, y: -r, width: w, height: 2 * r, rx: r, class: "token-pill" },
        group,
      );
      const t = svgEl(
        "text",
        {
          x: 0,
          y: 0,
          "text-anchor": "middle",
          "dominant-baseline": "central",
          class: "token-text",
        },
        group,
      );
      t.textContent = text;
    } else {
      svgEl("circle", { cx: 0, cy: 0, r, class: "token-dot" }, group);
    }
    const handle: TokenHandle = { id, kind: "token", el: group, r };
    return this._register(id, handle);
  }
}

/**
 * Infer which faces an edge should leave and enter, from the two endpoints'
 * relative position. Whichever axis has the larger centre-to-centre gap wins:
 * a mostly-vertical pair connects bottom<->top, a mostly-horizontal pair
 * left<->right. Endpoints without anchors (raw {x,y}) fall back to horizontal.
 * Returns [fromSide, toSide].
 */
function inferSides(from: EdgeEnd, to: EdgeEnd): [Side, Side] {
  const a = hasAnchor(from) ? from.anchor.centre : from;
  const b = hasAnchor(to) ? to.anchor.centre : to;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dy) > Math.abs(dx)) {
    return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
  }
  return dx >= 0 ? ["right", "left"] : ["left", "right"];
}

/** A single shared arrowhead marker in <defs>. */
function ensureArrowhead(svg: SVGSVGElement): void {
  if (svg.querySelector("#arrowhead")) return;
  let defs = svg.querySelector("defs");
  if (!defs) defs = svgEl("defs", {}, svg);
  const marker = svgEl(
    "marker",
    {
      id: "arrowhead",
      viewBox: "0 0 10 10",
      refX: 9,
      refY: 5,
      markerWidth: 7,
      markerHeight: 7,
      orient: "auto-start-reverse",
    },
    defs,
  );
  svgEl("path", { d: "M 0 0 L 10 5 L 0 10 z", class: "arrowhead" }, marker);
}
