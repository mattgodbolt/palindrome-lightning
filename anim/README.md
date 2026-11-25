# `anim/` — programmatic, seekable diagrams for reveal.js

A small toolkit for building **animated diagrams in code** that step in lock-step
with reveal.js navigation (forward, backward and jumping all land correctly).

It exists because the diagrams in these talks (data-flow graphs, pipelines,
"what happens when you click compile") are tedious to hand-author as markup and
fragile to animate with ad-hoc event handlers. Here you describe a diagram and
its animation as a short script; the toolkit handles drawing, easing and the
hard part: staying correct when the audience navigates backwards.

> Status: written for the CE-2026 talk. The intended use is a stylised graph of
> CE's components and an animated "life of a compile".

## Why this shape

Three deliberate choices, each of which earns its keep:

- **SVG, not canvas.** SVG elements are DOM nodes, so they are styled by the
  slide's ordinary CSS/LESS theme (fills, strokes, fonts, custom properties) -
  exactly like HTML - while still giving real vector geometry (curved edges,
  motion along a path) that HTML cannot. Canvas would render in a separate raster
  panel that ignores the slide theme; we don't want that seam.
- **One seekable timeline, not play-then-reverse.** The whole animation is a single
  GSAP timeline with a labelled stop per step. Navigation never "plays an
  animation forward and a reverse animation back"; it always **seeks to an
  absolute step**. The displayed state is therefore a pure function of the step
  index, so forward, backward and jumping are all automatically correct. This is
  the same idempotent principle as the old `reveal-rat` plugin and as Motion
  Canvas - just expressed as a timeline.
- **Create up front, animate properties only.** The scene builder creates _every_
  element a step might touch before any animation runs. The timeline then only
  ever tweens properties (opacity, transform, a CSS variable) of those existing
  elements. No element is created or destroyed mid-animation, which is precisely
  what makes seeking backwards reliable.

## The pieces

| File              | What it is                                                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stage.js`        | `Stage`: draws SVG primitives (box, label, value, node, cluster, edge, token) and hands back element handles. Render-only; it never animates.                                      |
| `timeline.js`     | `Steps`: a seekable, eased timeline over GSAP with domain verbs (`activate`, `morphValue`, `flow`) and `step()` / `seek()`.                                                        |
| `layout.js`       | `layoutDag()`: describe a graph (nodes, clusters, edges); dagre computes a deterministic layered layout; it draws the graph onto a `Stage` and returns named handles.              |
| `reveal-scene.js` | `RevealScene()`: a reveal.js plugin that loads each `scenes/<name>.js`, builds the scene, injects the right number of fragments, and seeks the timeline on every navigation event. |

A scene you write is a **factory** `({ stage, steps }) => void` that uses the
`stage` to draw and the `steps` to choreograph. The Quick start below is a
complete, self-contained example.

## Quick start

Adding a scene is two steps: write a file, reference it.

**1. Write `scenes/lifeOfCompile.js`** - one default-exported factory. The
filename is the scene's name.

```js
export default function ({ stage, steps }) {
  const alb = stage.node({ id: "alb", x: 60, y: 80, title: "Load balancer" });
  const be = stage.node({ id: "be", x: 360, y: 80, title: "Backend" });
  const wire = stage.edge({ from: alb, to: be });
  const req = stage.token({ id: "req", text: "POST /compile" });

  // Reads top-to-bottom like a storyboard. Each .step() is a key-press stop.
  steps.activate(alb).step();
  steps.flow(wire, req).activate(be).step();
}
```

**2. Reference it in a slide** by filename:

```html
<section>
  <div class="scene" data-scene="lifeOfCompile" data-viewbox="0 0 1000 560"></div>
</section>
```

That's it. The plugin loads `scenes/<data-scene>.js` on demand, so a new file
needs no import or registration. The deck just lists the plugin once:

```js
// in index.html
RevealScene();
```

To keep several related scenes in one file (sharing helpers, layout, a common
node set), name the export with `file:export`:

```html
<div class="scene" data-scene="lifecycle:read"></div>
<!-- export `read`  from scenes/lifecycle.js -->
<div class="scene" data-scene="lifecycle:compile"></div>
<!-- export `compile` from the same file -->
```

Draw, choreograph, mark steps. The plugin discovers that the scene has two steps
and injects two fragments, so the audience presses → to advance and ← to reverse,
with eased animation in both directions.

## Laying out graphs automatically

Hand-placing `x`/`y` on every node gets tedious fast, and re-spacing a diagram by
hand when you add a box is worse. `layoutDag()` lets you describe the graph and
have [dagre](https://github.com/dagrejs/dagre) compute the coordinates. dagre is a
_pure function_ of the description (no force simulation), so the layout is
deterministic and the scene stays seekable.

```js
import { layoutDag } from "../anim/layout.js";

export default function ({ stage, steps }) {
  const g = layoutDag(stage, {
    rankdir: "TB", // TB | BT | LR | RL
    ranksep: 70,
    nodesep: 45,
    nodes: {
      browser: { title: "Browser" },
      cloudfront: { title: "CloudFront" },
      alb: { title: "Load Bal." },
      s3: { title: "S3", className: "store" },
    },
    clusters: {
      serving: {
        title: "Serving fleet",
        children: {
          srv0: { title: "ce-node" },
          srv1: { title: "ce-node" },
        },
      },
    },
    edges: [
      ["browser", "cloudfront"],
      ["cloudfront", "alb"],
      ["alb", "serving"], // a cluster endpoint fans out to each child
      ["serving", "s3"],
    ],
  });

  // Every node/cluster is a named handle, so the storyboard reads by id:
  steps.activate(g.n.browser).step();
  steps.activate(g.n.alb).step();
  for (const e of g.edgesFrom("alb")) steps.flow(e, token, {}, steps.now());
}
```

What it returns:

| Field                               | What it is                                                         |
| ----------------------------------- | ------------------------------------------------------------------ |
| `g.n[id]`                           | every node, cluster child _and_ cluster container, by id           |
| `g.c[id]`                           | cluster containers only                                            |
| `g.e`                               | all edge handles, in declared order (after cluster fan-out)        |
| `g.edge(a, b)`                      | edge handle(s) between `a` and `b`                                 |
| `g.edgesFrom(id)` / `g.edgesTo(id)` | edges touching a node — matches the _logical_ endpoint (see below) |
| `g.width` / `g.height`              | laid-out extent (also set as the SVG `viewBox`)                    |

Details worth knowing:

- **Named handles, flat.** `g.n.alb`, `g.n.srv0`, `g.n.serving` all resolve
  regardless of nesting, which keeps the storyboard terse.
- **Cluster endpoints fan out.** An edge naming a cluster (`["alb", "serving"]`)
  expands to one edge per child. This is also what makes dagre rank the members
  under the ALB. `g.edgesFrom("alb")` still returns all the expanded edges,
  because edge queries match the _logical_ (pre-expansion) endpoint as well as
  the physical one.
- **Edge sides follow the rank axis, not geometry.** Within a layout, a ranked
  edge leaves the "downstream" face and enters the "upstream" one (bottom→top for
  `TB`), even when the two nodes are far apart horizontally — so a sideways
  fan-out still drops from the bottom rather than exiting a flank. (This is
  `layout.js`'s job; the generic `edge()` auto-inference below is for hand-placed
  edges that have no rank.)
- **Coordinates.** dagre reports node _centres_; `layoutDag` converts to the
  top-left origin `stage.node()` / `stage.cluster()` expect, and sizes the SVG
  `viewBox` to the computed extent.
- **Overrides.** Pass edge options as a third array element,
  `["alb", "s3", { fromSide: "right", curve: 40 }]`; they win over the computed
  sides.
- **Bidirectional edges.** `bidirectional: true` on the spec draws a second
  arrowhead at every edge's source (useful when the diagram shows round trips —
  request down, response back up). A per-edge `{ arrowStart: false }` opts an
  individual edge back out. Note this is cosmetic: a `flow()` token still travels
  one way per call, so animate the return leg with `{ reverse: true }`.

`layoutDag` needs the `@dagrejs/dagre` dependency. Everything else in `anim/`
works without it — reach for `layoutDag` only when you want automatic placement.

## Concepts

### Steps and the fragment index

reveal.js exposes the current fragment as `Reveal.getIndices().f`: `-1` before any
fragment is shown, then `0, 1, 2, …`. The plugin maps this to a **step**:

```
step = f + 1     // f = -1 (nothing shown) -> step 0, the initial state
```

`steps.step()` drops a label (`step-1`, `step-2`, …) at the current end of the
timeline. The plugin injects exactly `steps.stepCount` invisible reveal fragments
into the slide, so reveal's notion of "how many stops this slide has" matches the
storyboard. You never write a `<span class="fragment">` by hand.

### Seeking (why backward works)

On any navigation event the plugin calls `steps.seek(f + 1)`, which does
`timeline.tweenTo("step-N")`. Going forward tweens the playhead forward; going
back tweens it backward; arriving at the slide snaps (`{ animate: false }`).
Because every step's visual is fully determined by the timeline position, there
is no per-step "undo" to get wrong.

### Highlighting via CSS custom properties

`activate(handle)` tweens a CSS custom property `--active` from 0 → 1 on the
element (and `deactivate` back to 0). Your CSS decides what that means, typically
with `color-mix`:

```css
.rat-cell {
  --active: 0;
  fill: color-mix(in srgb, var(--cell-bg), var(--read-col) calc(var(--active) * 60%));
}
```

GSAP can tween custom properties, so the highlight eases smoothly and (crucially)
reverses cleanly. Use a second variable (e.g. `--write`) if you need a second,
independent highlight colour on the same element.

### Absolute timing within a step

Inside a step, place tweens at **absolute times** captured from `steps.now()`
(the current end of the timeline) rather than the fragile `"<"`/`">"`
insertion-relative positions:

```js
const t0 = steps.now();
steps.morphValue(asmLine, instr.asm, { duration: 0.35 }, t0); // at t0
steps.flow(edge, token, { duration: 0.55 }, t0 + 0.1); // overlaps
steps.morphValue(cell, newValue, { duration: 0.4 }, t0 + 0.5); // after the token lands
steps.step();
```

This keeps a step's beats deliberately overlapped into a tight (~0.9s) move.

## API reference

### `Stage`

`new Stage(svg)` wraps an `<svg>` (with a `viewBox`). It maintains four draw
layers - clusters under edges under nodes under tokens. Every primitive takes an
optional `id` (retrievable with `stage.get(id)`) and returns a **handle**. Handles
expose `.el` (the element to animate) and geometry.

| Method                                                                                | Draws                                | Handle highlights                                                      |
| ------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| `box({ id, x, y, w, h, rx?, className? })`                                            | a rounded rect                       | `el, rect, x, y, w, h, cx, cy`                                         |
| `label({ id, x, y, text, className?, anchor? })`                                      | a text label                         | `el, setText(s)`                                                       |
| `value({ id, x, y, text, className?, anchor? })`                                      | a morphable text "cell"              | `el, current, push(s)`                                                 |
| `node({ id, x, y, w?, h?, title, className?, titleClass? })`                          | a box + centred title (a component)  | `group, el, rect, label, cx, cy, anchor{top,bottom,left,right,centre}` |
| `cluster({ id, x, y, w, h, title, className?, titleClass? })`                         | a titled container that groups nodes | `group, el, rect, label, cx, cy, anchor{…}` (same as `node`)           |
| `edge({ id, from, to, fromSide?, toSide?, curve?, className?, arrow?, arrowStart? })` | a (curved) path between points/nodes | `el, path, length(), pointAt(t)`                                       |
| `token({ id, r?, text?, className? })`                                                | a hidden dot/pill that rides edges   | `el, r`                                                                |

Notes:

- `from`/`to` on `edge` accept either a `{ x, y }` point or a `node`/`cluster`
  handle; for those, `fromSide`/`toSide` pick an anchor (`right`, `left`, `top`,
  `bottom`, `centre`). Sides default to `"auto"`: the exit/entry faces are
  inferred from the two endpoints' relative position (whichever axis dominates),
  so a vertical pair connects bottom→top and a horizontal pair left→right without
  you specifying. Pass an explicit side to override. (Note `layoutDag` overrides
  `"auto"` with rank-aware sides — see "Laying out graphs automatically".)
  `curve` bows the path (perpendicular offset) so parallel edges don't overlap;
  `0` is straight. `arrow` (default `true`) draws the arrowhead at the
  destination; `arrowStart` adds a second head at the source for a bidirectional
  edge. The shared marker is `orient:auto-start-reverse`, so both heads point
  outward correctly.
- `cluster` is a `node`-shaped container drawn in the back layer, so member nodes
  sit on top of it. Its title sits top-left inside the box rather than centred.
  Used directly by `layoutDag` for grouped components (the serving fleet, the
  storage tier).
- `value` is a small stack of text elements at one spot. `push(s)` adds a new,
  invisible text on top and returns it; the old layers stay in the DOM so a
  backward seek simply re-reveals the previous value. `morphValue` (below) is the
  normal way to drive it.
- `token` is created hidden (`opacity 0`) and anchored at its group origin so
  MotionPath can translate it along an edge.

### `Steps`

`new Steps()` owns a paused GSAP timeline.

Navigation / structure:

- `step()` - mark a fragment stop; returns `this` (chainable).
- `stepCount` - number of steps declared (the plugin injects this many fragments).
- `now()` - current end time of the timeline; capture at the top of a step for
  absolute timing.
- `seek(index, { animate = true })` - tween the playhead to `step-index`
  (clamped). `index` is `f + 1`.

Raw tweens (escape hatch, with a sensible default ease/duration):

- `to(target, vars, at?)`, `fromTo(target, fromVars, toVars, at?)`,
  `set(target, vars, at?)` - thin GSAP passthroughs. `at` is a GSAP position
  (number = absolute time).

Domain verbs:

- `activate(handle, vars?, at?)` / `deactivate(…)` - tween `--active` 0↔1.
- `morphValue(valueHandle, newText, vars?, at?)` - cross-fade a `value` to a new
  string (old slides up and out, new rises into place). `vars.slide` sets the
  travel distance.
- `flow(edge, token, vars?, at?)` - fade the token in at the source, ride the
  edge path, fade out at the destination. `vars.reverse: true` runs it
  destination → source.

All verbs accept an `at` position so you can overlap beats; all are property
tweens, so all reverse cleanly.

### `RevealScene()`

Returns a reveal.js plugin; takes no arguments. For each `[data-scene="x"]` it
loads `scenes/x.js` and uses its default export as the scene factory
`({ stage, steps, container, deck }) => void`; `data-scene="x:name"` uses the
named export `name` instead, so one file can hold several scenes. On `ready` it:

1. finds every `[data-scene]`, creates an `<svg class="scene-svg">` inside it
   (viewBox from `data-viewbox`, default `0 0 1000 560`),
2. runs the factory to build the storyboard,
3. injects `steps.stepCount` invisible `.scene-fragment` spans into the slide and
   re-syncs reveal,
4. snaps each scene to its current step.

Thereafter it seeks the scene on the current slide on `fragmentshown`,
`fragmenthidden` and `slidechanged`.

## CSS contract

The toolkit only draws and animates; **you supply the look** in CSS/LESS. The
classes it emits:

- containers: `.scene-svg`, layers `.layer-clusters` / `.layer-edges` /
  `.layer-nodes` / `.layer-tokens`, injected stops `.scene-fragment` (style these
  `position:absolute; width:0; height:0; opacity:0 !important`).
- primitives: `.box`, `.label`, `.value` / `.value-text`, `.node` / `.node-box` /
  `.node-title`, `.cluster` / `.cluster-box` / `.cluster-title`, `.edge` (+ the
  shared `#arrowhead` marker, fill via `.arrowhead`), `.token` / `.token-pill` /
  `.token-text` / `.token-dot`.
- any extra `className` you pass a primitive is added alongside the above.
  `layoutDag` passes each node/cluster's `className` through, so e.g. a
  `className: "store"` groups the storage-tier nodes for styling.

For highlights, define `--active` (and any second variable like `--write`) with a
default of `0` on the elements you `activate`, and interpolate with `color-mix`.
A minimal but complete stylesheet:

```css
.scene-svg {
  width: 100%;
  height: 100%;
  font-family: inherit;
}
.scene-fragment {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0 !important;
  pointer-events: none;
}

.node-box {
  fill: #1b2233;
  stroke: #38445f;
}
.node-title,
.label,
.value-text {
  fill: #e7ecf5;
}

/* a box that lights up when activated. NB: declare --active on .node (the
   element activate() tweens); .node-box inherits it. */
.node {
  --active: 0;
}
.node-box {
  fill: color-mix(in srgb, #1b2233, #f3b54a calc(var(--active) * 60%));
}

.edge {
  stroke: #6f7fa6;
  stroke-width: 2;
  fill: none;
}
.arrowhead {
  fill: #6f7fa6;
}
.token-pill {
  fill: #4bd28a;
}
.token-text {
  fill: #06281a;
  font-weight: 700;
}
.token-dot {
  fill: #4bd28a;
}
```

## Gotchas

- **GSAP animates `style.opacity`, not the `opacity` attribute.** Initial opacity
  is set as an attribute when an element is created; once animated, read the
  _computed_ style (not the attribute) if you're inspecting state in a test.
- **Declare a highlight variable on the element you animate, not its child.**
  `activate()` tweens `--active` on the handle's `.el` (for a `node`, the group).
  If a child (e.g. `.node-box`) declares its own `--active`, that shadows the
  inherited value and the highlight won't show. Declare it on the group; let
  children inherit.
- **Don't mutate DOM or textContent inside a tween callback.** It won't reverse.
  Pre-create the elements (e.g. `value.push`) and tween their properties instead.
- **Keep a step's animation roughly a constant length** (~0.9s here) so a single
  key-press feels consistent; `tweenTo` plays the intervening time in real time.
- **Jumping within a single slide** via Home/End may not re-fire fragment events;
  arriving at a slide from an adjacent one fires `slidechanged`, which is handled.

## Dependencies

`gsap` (timelines + the now-free `MotionPathPlugin`) for the core toolkit, and
`@dagrejs/dagre` for `layoutDag` only (the rest of `anim/` works without it).
reveal.js is provided by the host deck.
