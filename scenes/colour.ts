/**
 * The colour trick. Colour bars on screen; underneath, the line a black and
 * white set sees (brightness only), then the same line with the colour
 * subcarrier riding on it: amplitude is saturation, phase is hue. Finally the
 * burst, the reference that tells the set where zero degrees is.
 */

import type { SceneContext } from "../anim/reveal-scene.js";
import {
  ACTIVE_US,
  BACK_PORCH_US,
  BLACK_LEVEL,
  BURST_START_US,
  BURST_US,
  CARTOON_SUBCARRIER,
  COLOUR_BARS,
  LINE_US,
  SYNC_LEVEL,
  SYNC_US,
  WHITE_LEVEL,
  css,
  el,
  lumaLevel,
  plot,
  rgbToYuv,
} from "./lib.js";

const SX = 500;
const SY = 10;
const SW = 600;
const SH = 450;

const WX = 100;
const X = (us: number) => WX + us * 20;
const Y = (level: number) => 840 - level * 280;
const US = (x: number) => (x - WX) / 20;

const ACTIVE_START = SYNC_US + BACK_PORCH_US;
const BAR_US = ACTIVE_US / COLOUR_BARS.length;
const BARS = COLOUR_BARS.map(rgbToYuv);
const W = 2 * Math.PI * CARTOON_SUBCARRIER;

function barAt(us: number) {
  const i = Math.floor((us - ACTIVE_START) / BAR_US);
  return i >= 0 && i < BARS.length ? BARS[i] : null;
}

/** The composite line. With `chroma` false, just the luma a B&W set uses. */
function level(us: number, chroma: boolean): number {
  const p = us % LINE_US;
  if (p < SYNC_US) return SYNC_LEVEL;
  if (chroma && p >= BURST_START_US && p < BURST_START_US + BURST_US) {
    // Burst at 135 degrees, 0.3 V peak-to-peak on a 1 V signal.
    return BLACK_LEVEL + 0.15 * Math.sin(W * p + (3 * Math.PI) / 4);
  }
  const bar = barAt(p);
  if (!bar) return BLACK_LEVEL;
  const gain = WHITE_LEVEL - BLACK_LEVEL;
  const c = chroma ? gain * (bar.u * Math.sin(W * p) + bar.v * Math.cos(W * p)) : 0;
  return lumaLevel(bar.y) + c;
}

export default function ({ stage, steps }: SceneContext): void {
  const back = stage.clusterLayer;

  el(
    "rect",
    { class: "tv-bezel", x: SX - 20, y: SY - 8, width: SW + 40, height: SH + 16, rx: 24 },
    back,
  );
  const colour = el("g", {}, back);
  const mono = el("g", {}, back);
  COLOUR_BARS.forEach((rgb, i) => {
    const x = SX + (i * SW) / COLOUR_BARS.length;
    const w = SW / COLOUR_BARS.length + 0.5;
    el("rect", { x, y: SY, width: w, height: SH, fill: css(rgb) }, colour);
    const y = BARS[i].y;
    el("rect", { x, y: SY, width: w, height: SH, fill: css({ r: y, g: y, b: y }) }, mono);
  });

  const axes = el("g", { class: "wave-axes" }, back);
  for (const lvl of [WHITE_LEVEL, BLACK_LEVEL, SYNC_LEVEL]) {
    el("line", { x1: WX, x2: X(70), y1: Y(lvl), y2: Y(lvl) }, axes);
  }

  const end = X(70);
  const luma = stage.path({
    className: "wave",
    d: plot(WX, end, (x) => Y(level(US(x), false)), 0.5),
  });
  const composite = stage.path({
    className: "wave chroma",
    d: plot(WX, end, (x) => Y(level(US(x), true)), 0.5),
  });

  const burstBox = el(
    "rect",
    {
      class: "burst-box",
      x: X(BURST_START_US) - 12,
      y: Y(BLACK_LEVEL) - 60,
      width: BURST_US * 20 + 24,
      height: 120,
      rx: 12,
      opacity: 0,
    },
    back,
  );

  const label = (y: number, text: string, cls = "side-label") => {
    const l = stage.label({ x: SX + SW + 50, y, text, anchor: "start", className: cls });
    l.el.setAttribute("opacity", "0");
    return l.el;
  };
  const bw = label(90, "brightness only");
  const sat = label(170, "size = saturation");
  const hue = label(230, "timing = hue");
  const burstLabel = stage.label({
    x: X(BURST_START_US) + 20,
    y: 525,
    text: "colour burst",
    className: "sync-label",
  });
  burstLabel.el.setAttribute("opacity", "0");

  // 1. What a black and white set sees.
  let t = steps.now();
  steps.draw(luma, { duration: 1.0 }, t).to(bw, { opacity: 1, duration: 0.3 }, t + 0.3);
  steps.step();

  // 2. Sneak a fast wiggle on top. The B&W set barely notices.
  t = steps.now();
  steps
    .to(luma.el, { opacity: 0.2, duration: 0.4 }, t)
    .draw(composite, { duration: 1.2 }, t)
    .to(mono, { opacity: 0, duration: 0.8 }, t + 0.4)
    .to(sat, { opacity: 1, duration: 0.3 }, t + 0.6)
    .to(hue, { opacity: 1, duration: 0.3 }, t + 0.9);
  steps.step();

  // 3. Timing relative to what? The burst.
  t = steps.now();
  steps
    .to(burstBox, { opacity: 1, duration: 0.3 }, t)
    .to(burstLabel.el, { opacity: 1, duration: 0.3 }, t);
  steps.step();
}
