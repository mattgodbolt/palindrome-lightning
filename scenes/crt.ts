/**
 * How a CRT works, side view: an electron gun fires a beam down the neck, the
 * deflection coils steer it, and wherever it lands the phosphor glows.
 */

import type { SceneContext } from "../anim/reveal-scene.js";
import { el } from "./lib.js";

const GUN = { x: 230, y: 350 };
// The glass faceplate: a quadratic from (FACE_X, FACE_TOP) to (FACE_X,
// FACE_BOTTOM) whose control point sits FACE_CTRL to the right, mid-height.
// Because the control point is at mid-height, y is linear in t.
const FACE_X = 1300;
const FACE_TOP = 60;
const FACE_BOTTOM = 640;
const FACE_CTRL = 90;
// The phosphor coats the inside of the faceplate: the same curve, nudged
// inward and trimmed short of the corners.
const PHOSPHOR_INSET = 11;
const PHOSPHOR_TRIM = 0.025;

/** A point on the inside of the faceplate at curve parameter t (0 = top). */
function phosphorAtT(t: number): { x: number; y: number } {
  return {
    x: FACE_X + 2 * FACE_CTRL * t * (1 - t) - PHOSPHOR_INSET,
    y: FACE_TOP + (FACE_BOTTOM - FACE_TOP) * t,
  };
}
const phosphorAt = (y: number) => phosphorAtT((y - FACE_TOP) / (FACE_BOTTOM - FACE_TOP));

/**
 * A beam bent by the deflection coils: straight from the gun, a smooth curve
 * through the coils, then straight to the target. The curve's control point
 * sits on the line back from the target, so the bend joins the final straight
 * with no kink.
 */
function bentBeam(target: { x: number; y: number }): string {
  const ctrl = { x: 640, y: GUN.y };
  const k = 0.12; // how far along the final straight the curve ends
  const exit = { x: ctrl.x + k * (target.x - ctrl.x), y: ctrl.y + k * (target.y - ctrl.y) };
  return `M${GUN.x},${GUN.y} L560,${GUN.y} Q${ctrl.x},${ctrl.y} ${exit.x},${exit.y} L${target.x},${target.y}`;
}

export default function ({ stage, steps }: SceneContext): void {
  const back = stage.clusterLayer;

  el(
    "path",
    {
      class: "crt-glass",
      d: `M90,300 L520,300 L${FACE_X},${FACE_TOP} Q${FACE_X + FACE_CTRL},${(FACE_TOP + FACE_BOTTOM) / 2} ${FACE_X},${FACE_BOTTOM} L520,400 L90,400 Z`,
    },
    back,
  );
  el("rect", { class: "crt-gun", x: 110, y: 320, width: 120, height: 60, rx: 8 }, back);
  stage.label({ x: 170, y: 450, text: "electron gun", className: "crt-caption" });
  const phosphorPts: string[] = [];
  for (let t = PHOSPHOR_TRIM; t <= 1 - PHOSPHOR_TRIM + 1e-9; t += 0.01) {
    const p = phosphorAtT(t);
    phosphorPts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  el("path", { class: "crt-screen", d: `M${phosphorPts.join("L")}` }, back);
  stage.label({ x: FACE_X + 30, y: 680, text: "phosphor", className: "crt-caption" });

  const coils = el("g", { class: "crt-coils" }, stage.nodeLayer);
  for (const y of [248, 412]) el("rect", { x: 540, y, width: 110, height: 40, rx: 10 }, coils);
  // The coils make one field across the neck, perpendicular to the page, and
  // that's what bends the beam: out of the page (dot) bends it up, into the
  // page (cross) bends it down. Drawn in the gap, behind the beam, so it
  // doesn't read as each magnet's own polarity. Size is the field's strength.
  const field = el("g", { class: "field-glyph", opacity: 0 }, back);
  const glyphs = [565, 625].flatMap((x) =>
    [318, 382].map((y) => {
      const g = el("g", {}, field);
      el("circle", { cx: 0, cy: 0, r: 14 }, g);
      const out = el("circle", { class: "field-out", cx: 0, cy: 0, r: 4 }, g);
      const into = el("path", { d: "M-9,-9 L9,9 M9,-9 L-9,9" }, g);
      return { g, out, into, x, y };
    }),
  );
  const coilLabel = stage.label({ x: 595, y: 200, text: "magnets", className: "crt-caption" });
  coilLabel.el.setAttribute("opacity", "0");

  // One beam whose bend follows the deflection s: +1 is the top of the screen,
  // -1 the bottom. GSAP tweens s and render() redraws everything from it, so
  // the morph stays seekable.
  const REACH = 240;
  const deflect = { s: 0 };
  const target = (s: number) => phosphorAt(GUN.y - s * REACH);
  const beam = stage.path({ className: "beam", d: bentBeam(target(0)) });
  const spot = el("circle", { class: "phosphor-glow", r: 26, opacity: 0 }, back);
  const render = () => {
    const { s } = deflect;
    const p = target(s);
    beam.el.setAttribute("d", bentBeam(p));
    spot.setAttribute("cx", `${p.x}`);
    spot.setAttribute("cy", `${p.y}`);
    coils.style.setProperty("--active", `${Math.abs(s)}`);
    for (const f of glyphs) {
      f.g.setAttribute("transform", `translate(${f.x},${f.y}) scale(${0.4 + 0.6 * Math.abs(s)})`);
      f.out.setAttribute("opacity", s >= 0 ? "1" : "0");
      f.into.setAttribute("opacity", s < 0 ? "1" : "0");
    }
  };
  render();

  // 1. Fire.
  let t = steps.now();
  steps.draw(beam, { duration: 0.5 }, t).to(spot, { opacity: 1, duration: 0.3 }, t + 0.4);
  steps.step();

  // 2. Magnets: crank the field one way and the beam bends up, reverse it and
  // the beam swings down. Do it fast enough, in a pattern, and you have a picture.
  t = steps.now();
  const morph = (s: number, duration: number, at: number) =>
    steps.to(deflect, { s, duration, ease: "sine.inOut", onUpdate: render }, at);
  steps
    .to(coilLabel.el, { opacity: 1, duration: 0.3 }, t)
    .to(field, { opacity: 1, duration: 0.3 }, t);
  morph(1, 0.9, t + 0.2);
  morph(-1, 1.6, t + 1.5);
  steps.step();
}
