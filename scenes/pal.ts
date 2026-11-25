/**
 * NTSC vs PAL as phasors, one idea per key press.
 *
 * A colour is an arrow on the U/V plane: angle is hue, length is saturation.
 * A phase error between studio and set rotates the arrow, so with NTSC every
 * line comes out the wrong hue. PAL flips V on alternate lines (a mirror in
 * the U axis). The same error still rotates the flipped arrow the same way,
 * but once the set flips it back, that line is wrong in the OPPOSITE
 * direction. Average two adjacent lines (the delay line) and the hue error
 * cancels, leaving a small loss of saturation: a factor of cos(error).
 *
 * The right-hand "screen" shows the result line by line, so the alternating
 * error and its cancellation are visible as stripes.
 */

import gsap from "gsap";

import type { SceneContext } from "../anim/reveal-scene.js";
import { css, el, rgbToYuv, yuvToRgb } from "./lib.js";

const CX = 400;
const CY = 390;
const SCALE = 1200; // px per unit of U/V
const ERROR_DEG = 40;
const SKIN = { r: 0.85, g: 0.6, b: 0.45 };

// The "screen": a sent-colour chip, then a stack of picture lines.
const CHIP_X = 860;
const LINES_X = 1020;
const LINES_W = 480;
const LINES_Y = 80;
const LINE_H = 32;
const N_LINES = 8;

interface Phasor {
  /** Mirror group: scaleY -1 is the PAL V flip. */
  mirror: SVGGElement;
  /** The arrow itself: rotation is the angle before mirroring. */
  arrow: SVGGElement;
}

/** An arrow from the wheel centre, inside a group that can mirror it in U. */
function phasor(parent: Element, length: number, cls: string): Phasor {
  const outer = el("g", { transform: `translate(${CX},${CY})` }, parent);
  const mirror = el("g", {}, outer);
  const arrow = el("g", { class: `phasor ${cls}` }, mirror);
  el("line", { x1: 0, y1: 0, x2: length - 22, y2: 0 }, arrow);
  el("polygon", { points: `${length},0 ${length - 30},-15 ${length - 30},15` }, arrow);
  gsap.set(mirror, { svgOrigin: "0 0", scaleY: 1 });
  return { mirror, arrow };
}

/** SVG rotation (clockwise degrees) for a maths angle (anticlockwise radians). */
const rot = (theta: number) => (-theta * 180) / Math.PI;

export default function ({ stage, steps }: SceneContext): void {
  const back = stage.clusterLayer;
  const { y, u, v } = rgbToYuv(SKIN);
  const theta = Math.atan2(v, u);
  const mag = Math.hypot(u, v);
  const err = (ERROR_DEG * Math.PI) / 180;
  const colourAt = (angle: number, m = mag) =>
    css(yuvToRgb(y, m * Math.cos(angle), m * Math.sin(angle)));

  // --- the wheel -------------------------------------------------------------
  const N = 90;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * 2 * Math.PI;
    const a1 = ((i + 1.05) / N) * 2 * Math.PI;
    const [r0, r1] = [290, 330];
    const p = (r: number, a: number) => `${CX + r * Math.cos(a)},${CY - r * Math.sin(a)}`;
    el(
      "path",
      {
        d: `M${p(r0, a0)} L${p(r1, a0)} A${r1},${r1} 0 0 0 ${p(r1, a1)} L${p(r0, a1)} A${r0},${r0} 0 0 1 ${p(r0, a0)} Z`,
        fill: colourAt((a0 + a1) / 2, 0.3),
      },
      back,
    );
  }
  const axes = el("g", { class: "wave-axes" }, back);
  el("line", { x1: CX - 280, x2: CX + 280, y1: CY, y2: CY }, axes);
  el("line", { x1: CX, x2: CX, y1: CY - 280, y2: CY + 280 }, axes);
  stage.label({ x: CX + 270, y: CY - 22, text: "U", className: "axis-label" });
  stage.label({ x: CX + 22, y: CY - 268, text: "V", className: "axis-label", anchor: "start" });

  const len = mag * SCALE;
  const layer = stage.nodeLayer;
  const sent = phasor(layer, len, "sent");
  const odd = phasor(layer, len, "received");
  const even = phasor(layer, len, "received alt");
  const avg = phasor(layer, len, "average");
  for (const p of [sent, odd, even, avg]) {
    gsap.set(p.arrow, { svgOrigin: "0 0", rotation: rot(theta), opacity: 0 });
  }

  // --- the screen ------------------------------------------------------------
  el(
    "rect",
    {
      class: "swatch",
      x: CHIP_X,
      y: LINES_Y,
      width: 120,
      height: N_LINES * LINE_H,
      rx: 12,
      fill: css(SKIN),
    },
    back,
  );
  stage.label({
    x: CHIP_X + 60,
    y: LINES_Y + N_LINES * LINE_H + 40,
    text: "sent",
    className: "swatch-label",
  });
  el(
    "rect",
    {
      class: "tv-bezel",
      x: LINES_X - 14,
      y: LINES_Y - 14,
      width: LINES_W + 28,
      height: N_LINES * LINE_H + 28,
      rx: 18,
    },
    back,
  );
  const oddLines: SVGRectElement[] = [];
  const evenLines: SVGRectElement[] = [];
  for (let i = 0; i < N_LINES; i++) {
    const r = el(
      "rect",
      { x: LINES_X, y: LINES_Y + i * LINE_H, width: LINES_W, height: LINE_H - 3, fill: css(SKIN) },
      back,
    );
    (i % 2 ? evenLines : oddLines).push(r);
  }
  stage.label({
    x: LINES_X + LINES_W / 2,
    y: LINES_Y + N_LINES * LINE_H + 40,
    text: "on screen, line by line",
    className: "swatch-label",
  });

  // --- captions: one title + one line per beat, cross-faded ------------------
  const make = (text: string, yy: number, cls: string) => {
    const l = stage.label({ x: 1180, y: yy, text, className: cls });
    l.el.setAttribute("opacity", "0");
    return l.el;
  };
  let shown: SVGTextElement[] = [];
  const caption = (t: number, title: string | null, sub: string) => {
    const next: SVGTextElement[] = [make(sub, 620, "side-label")];
    if (title) next.unshift(make(title, 540, "pal-title"));
    const keep = title ? [] : shown.filter((e) => e.classList.contains("pal-title"));
    for (const e of shown) if (!keep.includes(e)) steps.to(e, { opacity: 0, duration: 0.25 }, t);
    for (const e of next) steps.to(e, { opacity: 1, duration: 0.3 }, t + 0.2);
    shown = [...keep, ...next];
  };

  // 1. A colour is an arrow.
  let t = steps.now();
  steps.to(sent.arrow, { opacity: 1, duration: 0.4 }, t);
  caption(t, "Colour is an arrow", "angle = hue, length = saturation");
  steps.step();

  // 2. NTSC: a phase error on the way rotates every line the same way.
  t = steps.now();
  steps
    .to(odd.arrow, { opacity: 1, duration: 0.2 }, t)
    .to(odd.arrow, { rotation: rot(theta + err), duration: 0.8 }, t)
    .to([...oddLines, ...evenLines], { fill: colourAt(theta + err), duration: 0.8 }, t);
  caption(t, "NTSC: Never The Same Colour", "phase error: every line the wrong hue");
  steps.step();

  // 3. PAL: the studio flips V on every other line.
  t = steps.now();
  steps
    .to(even.arrow, { opacity: 1, duration: 0.2 }, t)
    .to(even.mirror, { scaleY: -1, duration: 0.7 }, t);
  caption(t, "PAL: Phase Alternating Line", "flip V on every other line");
  steps.step();

  // 4. The same error hits the flipped line, rotating it the same way.
  t = steps.now();
  steps.to(even.arrow, { rotation: rot(theta - err), duration: 0.8 }, t);
  caption(t, null, "same error, same direction...");
  steps.step();

  // 5. The set flips it back: now that line is wrong the OTHER way.
  t = steps.now();
  steps
    .to(even.mirror, { scaleY: 1, duration: 0.7 }, t)
    .to(evenLines, { fill: colourAt(theta - err), duration: 0.6 }, t + 0.3);
  caption(t, null, "...flip it back: wrong the other way!");
  steps.step();

  // 6. Average adjacent lines: right hue, slightly less saturated.
  t = steps.now();
  steps
    .to([odd.arrow, even.arrow], { opacity: 0.35, duration: 0.4 }, t)
    .to(avg.arrow, { opacity: 1, scale: Math.cos(err), duration: 0.6 }, t)
    .to(
      [...oddLines, ...evenLines],
      { fill: colourAt(theta, mag * Math.cos(err)), duration: 0.6 },
      t,
    );
  caption(t, null, "average two lines: errors cancel");
  steps.step();
}
