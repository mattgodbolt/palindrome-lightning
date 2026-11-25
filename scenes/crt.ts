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
  el("rect", { x: 540, y: 248, width: 110, height: 40, rx: 10 }, coils);
  el("rect", { x: 540, y: 412, width: 110, height: 40, rx: 10 }, coils);
  const coilLabel = stage.label({ x: 595, y: 200, text: "magnets", className: "crt-caption" });
  coilLabel.el.setAttribute("opacity", "0");

  // Beams: straight, then bent up and down by the coils.
  const mid = phosphorAt(350);
  const top = phosphorAt(110);
  const bottom = phosphorAt(590);
  const straight = stage.path({ className: "beam", d: `M${GUN.x},${GUN.y} L${mid.x},${mid.y}` });
  const up = stage.path({
    className: "beam",
    d: bentBeam(top),
  });
  const down = stage.path({
    className: "beam",
    d: bentBeam(bottom),
  });

  const glow = ({ x, y }: { x: number; y: number }) =>
    el("circle", { class: "phosphor-glow", cx: x, cy: y, r: 26, opacity: 0 }, back);
  const gMid = glow(mid);
  const gUp = glow(top);
  const gDown = glow(bottom);

  // 1. Fire.
  let t = steps.now();
  steps.draw(straight, { duration: 0.5 }, t).to(gMid, { opacity: 1, duration: 0.3 }, t + 0.4);
  steps.step();

  // 2. Steer up.
  t = steps.now();
  steps
    .to(straight.el, { opacity: 0, duration: 0.3 }, t)
    .to(gMid, { opacity: 0, duration: 0.3 }, t)
    .activate(coils, { duration: 0.3 }, t)
    .to(coilLabel.el, { opacity: 1, duration: 0.3 }, t)
    .draw(up, { duration: 0.5 }, t + 0.2)
    .to(gUp, { opacity: 1, duration: 0.3 }, t + 0.6);
  steps.step();

  // 3. And down. Do it fast enough, in a pattern, and you have a picture.
  t = steps.now();
  steps
    .to(up.el, { opacity: 0, duration: 0.3 }, t)
    .to(gUp, { opacity: 0, duration: 0.6 }, t)
    .draw(down, { duration: 0.5 }, t + 0.2)
    .to(gDown, { opacity: 1, duration: 0.3 }, t + 0.6);
  steps.step();
}
