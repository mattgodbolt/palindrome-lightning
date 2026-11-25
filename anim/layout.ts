/**
 * layoutDag: declarative graph layout for anim/ scenes.
 *
 * Describe an architecture as nodes, clusters and edges; dagre computes a
 * deterministic layered layout; we draw it onto a Stage and hand back named
 * handles so the storyboard can animate by id. Because the layout is a pure
 * function of the description (no force simulation), the scene stays fully
 * seekable - the same principle as the rest of the toolkit.
 *
 *   const g = layoutDag(stage, {
 *     rankdir: "TB",
 *     nodes: {
 *       browser:    { title: "Browser" },
 *       cloudfront: { title: "CloudFront" },
 *       alb:        { title: "Load Bal." },
 *       s3: { title: "S3", className: "store" },
 *     },
 *     clusters: {
 *       serving: { title: "Serving fleet", children: {
 *         srv0: { title: "ce-node" }, srv1: { title: "ce-node" },
 *       }},
 *     },
 *     edges: [
 *       ["browser", "cloudfront"], ["cloudfront", "alb"],
 *       ["alb", "serving"],        // a cluster endpoint fans out to its children
 *       ["serving", "s3"],
 *     ],
 *   });
 *
 * Returns:
 *   g.n[id]         every node, cluster child and cluster container, by id
 *   g.c[id]         cluster containers only
 *   g.e             all edge handles, in declared order (after fan-out expansion)
 *   g.edge(a,b)     the edge handle(s) between a and b
 *   g.edgesFrom(id) / g.edgesTo(id)   edges touching a node (id or cluster child)
 *   g.width/height  the laid-out extent, for sizing the svg viewBox
 *
 * dagre reports node positions as CENTRES; stage.node()/cluster() take a
 * top-left origin, so we convert here once.
 */

import dagre from "@dagrejs/dagre";
import type { EdgeLabel, GraphLabel, NodeLabel } from "@dagrejs/dagre";
import type { Graph } from "@dagrejs/graphlib";

import type { BoxHandle, EdgeHandle, Side, Stage } from "./stage.js";

/**
 * An edge handle as returned by layoutDag, tagged with the endpoints it
 * connects (both the physical node ids and the logical, pre-fan-out ids).
 */
export type LaidEdge = EdgeHandle & {
  a: string;
  b: string;
  fromLogical: string;
  toLogical: string;
};

/** A single node's description in a LayoutSpec. */
export interface NodeDef {
  title?: string;
  w?: number;
  h?: number;
  className?: string;
  titleClass?: string;
}

/** A cluster: a node-shaped container with named children. */
export interface ClusterDef extends NodeDef {
  children?: Record<string, NodeDef>;
}

/** Per-edge overrides, passed as the third element of an edge tuple. */
export interface EdgeOptions {
  fromSide?: Side;
  toSide?: Side;
  curve?: number;
  className?: string;
  arrow?: boolean;
  arrowStart?: boolean;
}

/** How an edge may be declared: a tuple (optionally with overrides) or an object. */
export type EdgeSpec =
  [string, string] | [string, string, EdgeOptions] | { from: string; to: string };

/** The full description passed to layoutDag(). */
export interface LayoutSpec {
  rankdir?: "TB" | "BT" | "LR" | "RL";
  ranksep?: number;
  nodesep?: number;
  marginx?: number;
  marginy?: number;
  /** draw a source arrowhead on every edge */
  bidirectional?: boolean;
  nodes?: Record<string, NodeDef>;
  clusters?: Record<string, ClusterDef>;
  edges?: EdgeSpec[];
}

/** The laid-out graph returned by layoutDag(). */
export interface LaidGraph {
  /** every node, cluster child and cluster container, by id */
  n: Record<string, BoxHandle>;
  /** cluster containers only */
  c: Record<string, BoxHandle>;
  /** all edge handles, in declared order */
  e: LaidEdge[];
  /** laid-out extent (also the SVG viewBox width) */
  width: number;
  /** laid-out extent (also the SVG viewBox height) */
  height: number;
  /** edge handle(s) between a and b */
  edge: (a: string, b: string) => LaidEdge[];
  /** edges leaving a node (logical or physical id) */
  edgesFrom: (id: string) => LaidEdge[];
  /** edges entering a node (logical or physical id) */
  edgesTo: (id: string) => LaidEdge[];
}

/**
 * The node label we attach to dagre nodes. It is dagre's own NodeLabel (which
 * carries width/height in and x/y - centres - back out after layout) plus our
 * own draw metadata, so we can build stage handles once the layout is computed.
 */
interface DagreNode extends NodeLabel {
  _def?: NodeDef;
  _cluster?: boolean;
}

type DagreGraph = Graph<GraphLabel, DagreNode, EdgeLabel>;

const DEFAULT_NODE = { w: 200, h: 90 };

/**
 * Choose exit/entry faces for a ranked edge from the layout direction. In a
 * TB/BT layout ranks stack vertically, so edges leave the bottom and enter the
 * top (flipped for an edge that points up a rank); LR/RL is the horizontal
 * mirror. The centre delta only picks the sign, never the axis - that is what
 * keeps a sideways fan-out (ALB -> outer fleet nodes) exiting the bottom rather
 * than the flank.
 */
function sidesForRank(rankdir: string, a: BoxHandle, b: BoxHandle): [Side, Side] {
  const vertical = rankdir === "TB" || rankdir === "BT";
  if (vertical) {
    return b.cy >= a.cy ? ["bottom", "top"] : ["top", "bottom"];
  }
  return b.cx >= a.cx ? ["right", "left"] : ["left", "right"];
}

/** An edge after fan-out: the physical endpoints, the logical ones and overrides. */
interface DeclaredEdge {
  a: string;
  b: string;
  from: string;
  to: string;
  opts: EdgeOptions;
}

export function layoutDag(stage: Stage, spec: LayoutSpec): LaidGraph {
  const {
    rankdir = "TB",
    ranksep = 70,
    nodesep = 45,
    marginx = 20,
    marginy = 20,
    bidirectional = false,
    nodes = {},
    clusters = {},
    edges = [],
  } = spec;

  const g: DagreGraph = new dagre.graphlib.Graph({ compound: true });
  g.setGraph({ rankdir, ranksep, nodesep, marginx, marginy });
  g.setDefaultEdgeLabel(() => ({}));

  // Record which ids are cluster containers and their members, so edges naming a
  // cluster can be expanded to its children (dagre can't rank an edge to a
  // compound parent).
  const clusterChildren = new Map<string, string[]>();

  for (const [id, def] of Object.entries(nodes)) {
    g.setNode(id, {
      width: def.w ?? DEFAULT_NODE.w,
      height: def.h ?? DEFAULT_NODE.h,
      _def: def,
    });
  }
  for (const [cid, cdef] of Object.entries(clusters)) {
    // A compound parent: dagre sizes it from its children, so seed 0x0.
    g.setNode(cid, { width: 0, height: 0, _def: cdef, _cluster: true });
    const kids: string[] = [];
    for (const [mid, mdef] of Object.entries(cdef.children ?? {})) {
      g.setNode(mid, {
        width: mdef.w ?? DEFAULT_NODE.w,
        height: mdef.h ?? DEFAULT_NODE.h,
        _def: mdef,
      });
      g.setParent(mid, cid);
      kids.push(mid);
    }
    clusterChildren.set(cid, kids);
  }

  // Expand cluster endpoints to their children, remembering the logical
  // (pre-expansion) endpoints so edge queries can still ask "edges from alb"
  // even though the ranked edge targets srv0/srv1/...
  const expand = (id: string): string[] => clusterChildren.get(id) ?? [id];
  const declaredEdges: DeclaredEdge[] = [];
  for (const edgeSpec of edges) {
    const [from, to, opts = {}] = Array.isArray(edgeSpec)
      ? edgeSpec
      : [edgeSpec.from, edgeSpec.to, {} as EdgeOptions];
    for (const a of expand(from)) {
      for (const b of expand(to)) {
        g.setEdge(a, b);
        declaredEdges.push({ a, b, from, to, opts });
      }
    }
  }

  dagre.layout(g);

  const gg = g.graph();
  const width = gg.width ?? 0;
  const height = gg.height ?? 0;
  const result: Pick<LaidGraph, "n" | "c" | "e" | "width" | "height"> = {
    n: {},
    c: {},
    e: [],
    width,
    height,
  };

  // Size the SVG to the computed extent so the diagram is neither clipped nor
  // adrift in the default viewBox. The container's aspect ratio still governs
  // on-screen scale (see reveal-scene.ts preserveAspectRatio).
  stage.svg.setAttribute("viewBox", `0 0 ${Math.ceil(width)} ${Math.ceil(height)}`);

  // dagre reports centres; stage.node()/cluster() take a top-left origin.
  const drawParams = (nd: DagreNode, def: NodeDef) => ({
    x: (nd.x ?? 0) - nd.width / 2,
    y: (nd.y ?? 0) - nd.height / 2,
    w: nd.width,
    h: nd.height,
    title: def.title ?? "",
    className: def.className ?? "",
    titleClass: def.titleClass ?? "",
  });

  // Draw clusters first (back layer), then plain/member nodes on top.
  for (const cid of clusterChildren.keys()) {
    const nd = g.node(cid);
    result.n[cid] = result.c[cid] = stage.cluster({ id: cid, ...drawParams(nd, nd._def ?? {}) });
  }
  for (const id of g.nodes()) {
    const nd = g.node(id);
    if (nd._cluster) continue;
    result.n[id] = stage.node({ id, ...drawParams(nd, nd._def ?? {}) });
  }

  // Draw edges between the resolved node handles, tagged with their logical
  // endpoints for querying. Sides follow the layout's rank axis (vertical for
  // TB/BT, horizontal for LR/RL) rather than the generic dominant-axis guess:
  // dagre has already placed these on adjacent ranks, so an edge that fans out
  // sideways should still leave the bottom and enter the top, not the flanks.
  for (const { a, b, from, to, opts } of declaredEdges) {
    const [fromSide, toSide] = sidesForRank(rankdir, result.n[a], result.n[b]);
    // `bidirectional` is a layout-wide default; a per-edge arrowStart overrides.
    const handle = stage.edge({
      from: result.n[a],
      to: result.n[b],
      fromSide,
      toSide,
      arrowStart: bidirectional,
      ...opts,
    }) as LaidEdge;
    handle.a = a;
    handle.b = b;
    handle.fromLogical = from;
    handle.toLogical = to;
    result.e.push(handle);
  }

  const matches = (edge: LaidEdge, id: string, end: "from" | "to"): boolean => {
    const phys = end === "from" ? edge.a : edge.b;
    const logi = end === "from" ? edge.fromLogical : edge.toLogical;
    return phys === id || logi === id;
  };
  return {
    ...result,
    edge: (a: string, b: string) =>
      result.e.filter((e) => matches(e, a, "from") && matches(e, b, "to")),
    edgesFrom: (id: string) => result.e.filter((e) => matches(e, id, "from")),
    edgesTo: (id: string) => result.e.filter((e) => matches(e, id, "to")),
  };
}
