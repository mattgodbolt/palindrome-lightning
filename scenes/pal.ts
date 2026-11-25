/**
 * NTSC vs PAL as phasors. A colour is an arrow on the U/V plane: the angle is
 * hue, the length saturation. A phase error on the way rotates the arrow, so
 * NTSC gets the wrong hue. PAL flips V on alternate lines, so the same error
 * rotates the next line's arrow the OTHER way once it is flipped back;
 * averaging the two lines cancels the hue error and costs only a little
 * saturation (a factor of cos(error)).
 */

import gsap from "gsap";

import type { SceneContext } from "../anim/reveal-scene.js";
import { css, el, rgbToYuv, yuvToRgb } from "./lib.js";

const CX = 420;
const CY = 380;
const SCALE = 1200; // px per unit of U/V
const ERROR_DEG = 40;

const SKIN = { r: 0.85, g: 0.6, b: 0.45 };

/** An arrow from the wheel centre; returns the inner group to rotate/scale. */
function arrow(parent: Element, length: number, cls: string): SVGGElement {
  const outer = el("g", { transform: `translate(${CX},${CY})` }, parent);
  const g = el("g", { class: `phasor ${cls}` }, outer);
  el("line", { x1: 0, y1: 0, x2: length - 22, y2: 0 }, g);
  el("polygon", { points: `${length},0 ${length - 30},-15 ${length - 30},15` }, g);
  return g;
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

  // Hue ring: what each angle means, at a fixed saturation.
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
  const sent = arrow(layer, len, "sent");
  const line1 = arrow(layer, len, "received");
  const line2 = arrow(layer, len, "received alt");
  const avg = arrow(layer, len, "average");
  for (const g of [sent, line1, line2, avg])
    gsap.set(g, { svgOrigin: "0 0", rotation: rot(theta), opacity: 0 });

  // Swatches: what was sent, what the set shows.
  const sw = (x: number, label: string) => {
    const r = el(
      "rect",
      { class: "swatch", x, y: 150, width: 230, height: 230, rx: 16, fill: css(SKIN) },
      back,
    );
    stage.label({ x: x + 115, y: 420, text: label, className: "swatch-label" });
    return r;
  };
  sw(900, "sent");
  const shown = sw(1200, "on screen");

  const title = (text: string) => {
    const l = stage.label({ x: 1140, y: 560, text, className: "pal-title" });
    l.el.setAttribute("opacity", "0");
    return l.el;
  };
  const ntsc = title("NTSC: Never The Same Colour");
  const pal = title("PAL: Phase Alternating Line");
  const sub = stage.label({
    x: 1140,
    y: 640,
    text: "errors cancel, line by line",
    className: "side-label",
  });
  sub.el.setAttribute("opacity", "0");

  // 1. A colour is an arrow.
  let t = steps.now();
  steps.to(sent, { opacity: 1, duration: 0.4 }, t);
  steps.step();

  // 2. NTSC: a phase error on the way rotates it. Wrong hue.
  t = steps.now();
  steps
    .to(line1, { opacity: 1, duration: 0.2 }, t)
    .to(line1, { rotation: rot(theta + err), duration: 0.8 }, t)
    .to(shown, { fill: colourAt(theta + err), duration: 0.8 }, t)
    .to(ntsc, { opacity: 1, duration: 0.3 }, t + 0.4);
  steps.step();

  // 3. PAL: next line V is flipped, so the same error lands the other side.
  t = steps.now();
  steps
    .to(ntsc, { opacity: 0, duration: 0.3 }, t)
    .to(pal, { opacity: 1, duration: 0.3 }, t + 0.2)
    .to(line2, { opacity: 1, duration: 0.2 }, t)
    .to(line2, { rotation: rot(theta - err), duration: 0.8 }, t);
  steps.step();

  // 4. Average the two lines: right hue, slightly less saturated.
  t = steps.now();
  steps
    .to([line1, line2], { opacity: 0.35, duration: 0.4 }, t)
    .to(avg, { opacity: 1, scale: Math.cos(err), duration: 0.6 }, t)
    .to(shown, { fill: colourAt(theta, mag * Math.cos(err)), duration: 0.6 }, t)
    .to(sub.el, { opacity: 1, duration: 0.3 }, t + 0.3);
  steps.step();
}
