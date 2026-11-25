/**
 * How a CRT works, side view: an electron gun fires a beam down the neck, the
 * deflection coils steer it, and wherever it lands the phosphor glows.
 */

import type { SceneContext } from "../anim/reveal-scene.js";
import { el } from "./lib.js";

const GUN = { x: 230, y: 350 };
const SCREEN_X = 1330;

export default function ({ stage, steps }: SceneContext): void {
  const back = stage.clusterLayer;

  el(
    "path",
    {
      class: "crt-glass",
      d: `M90,300 L520,300 L${SCREEN_X - 30},60 Q${SCREEN_X + 30},350 ${SCREEN_X - 30},640 L520,400 L90,400 Z`,
    },
    back,
  );
  el("rect", { class: "crt-gun", x: 110, y: 320, width: 120, height: 60, rx: 8 }, back);
  stage.label({ x: 170, y: 450, text: "electron gun", className: "crt-caption" });
  el("rect", { class: "crt-screen", x: SCREEN_X - 12, y: 70, width: 14, height: 560 }, back);
  stage.label({ x: SCREEN_X + 30, y: 680, text: "phosphor", className: "crt-caption" });

  const coils = el("g", { class: "crt-coils" }, stage.nodeLayer);
  el("rect", { x: 540, y: 248, width: 110, height: 40, rx: 10 }, coils);
  el("rect", { x: 540, y: 412, width: 110, height: 40, rx: 10 }, coils);
  const coilLabel = stage.label({ x: 595, y: 200, text: "magnets", className: "crt-caption" });
  coilLabel.el.setAttribute("opacity", "0");

  // Beams: straight, then bent up and down by the coils.
  const straight = stage.path({ className: "beam", d: `M${GUN.x},${GUN.y} L${SCREEN_X},350` });
  const up = stage.path({
    className: "beam",
    d: `M${GUN.x},${GUN.y} L560,350 Q640,350 700,300 L${SCREEN_X},110`,
  });
  const down = stage.path({
    className: "beam",
    d: `M${GUN.x},${GUN.y} L560,350 Q640,350 700,400 L${SCREEN_X},590`,
  });

  const glow = (y: number) =>
    el("circle", { class: "phosphor-glow", cx: SCREEN_X - 5, cy: y, r: 26, opacity: 0 }, back);
  const gMid = glow(350);
  const gUp = glow(110);
  const gDown = glow(590);

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
