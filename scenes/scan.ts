/**
 * The black-and-white signal. A screen on top, the voltage for one line
 * underneath. The beam paints a line as the waveform draws; an H sync pulse
 * sends it back to the left; repeat; a V sync sends it back to the top.
 *
 * Line timings and levels are to scale; the picture is a greyscale staircase so
 * brightness-is-voltage reads straight off the waveform.
 */

import type { SceneContext } from "../anim/reveal-scene.js";
import {
  BACK_PORCH_US,
  BLACK_LEVEL,
  LINE_US,
  SYNC_LEVEL,
  SYNC_US,
  ACTIVE_US,
  WHITE_LEVEL,
  el,
  lumaLevel,
  plot,
  uniqueId,
} from "./lib.js";

// Screen geometry.
const SX = 500;
const SY = 10;
const SW = 600;
const SH = 450;
const LINE_H = 15;
const BARS = 8;

// Waveform geometry: 70 us across 1400 px, levels across 280 px.
const WX = 100;
const PX_PER_US = 20;
const X = (us: number) => WX + us * PX_PER_US;
const Y = (level: number) => 840 - level * 280;

const ACTIVE_START = SYNC_US + BACK_PORCH_US;
const ACTIVE_END = ACTIVE_START + ACTIVE_US;

export default function ({ stage, steps }: SceneContext): void {
  const back = stage.clusterLayer;
  const defs = el("defs", {}, stage.svg);

  // --- the screen ------------------------------------------------------------
  el(
    "rect",
    { class: "tv-bezel", x: SX - 20, y: SY - 8, width: SW + 40, height: SH + 16, rx: 24 },
    back,
  );
  el("rect", { class: "tv-off", x: SX, y: SY, width: SW, height: SH }, back);

  // The picture is revealed through a clip: one growing line, then a growing
  // block, i.e. exactly what the beam has painted so far.
  const clipId = uniqueId("painted");
  const clip = el("clipPath", { id: clipId }, defs);
  const lineRect = el("rect", { x: SX, y: SY, width: 0, height: LINE_H }, clip);
  const blockRect = el("rect", { x: SX, y: SY, width: SW, height: 0 }, clip);

  const picture = el("g", { "clip-path": `url(#${clipId})` }, back);
  for (let i = 0; i < BARS; i++) {
    const grey = Math.round(255 * (1 - i / (BARS - 1)));
    el(
      "rect",
      {
        x: SX + (i * SW) / BARS,
        y: SY,
        width: SW / BARS + 0.5,
        height: SH,
        fill: `rgb(${grey},${grey},${grey})`,
      },
      picture,
    );
  }
  // Visible scanlines, so it reads as lines rather than a flat image.
  const patId = uniqueId("scanlines");
  const pat = el(
    "pattern",
    { id: patId, width: 8, height: LINE_H, patternUnits: "userSpaceOnUse" },
    defs,
  );
  el("rect", { x: 0, y: LINE_H - 4, width: 8, height: 4, class: "scanline-gap" }, pat);
  el("rect", { x: SX, y: SY, width: SW, height: SH, fill: `url(#${patId})` }, picture);

  // --- the waveform axes -----------------------------------------------------
  const axes = el("g", { class: "wave-axes" }, back);
  for (const [lvl, name] of [
    [WHITE_LEVEL, "white"],
    [BLACK_LEVEL, "black"],
    [SYNC_LEVEL, "sync"],
  ] as const) {
    el("line", { x1: WX, x2: X(70), y1: Y(lvl), y2: Y(lvl) }, axes);
    stage.label({ x: WX - 15, y: Y(lvl), text: name, anchor: "end", className: "wave-level" });
  }

  // Guides tying the active part of the line to the width of the screen.
  const guides = el("g", { class: "wave-guide", opacity: 0 }, back);
  el("line", { x1: SX, y1: SY + SH + 8, x2: X(ACTIVE_START), y2: Y(WHITE_LEVEL) - 20 }, guides);
  el("line", { x1: SX + SW, y1: SY + SH + 8, x2: X(ACTIVE_END), y2: Y(WHITE_LEVEL) - 20 }, guides);

  // --- the line waveform, in three pieces so each can be drawn on its own ----
  const line = el("g", {}, stage.edgeLayer);
  const yb = Y(BLACK_LEVEL);
  const ys = Y(SYNC_LEVEL);
  const syncA = stage.path({
    className: "wave sync-pulse",
    d: `M${X(0)},${yb} L${X(0)},${ys} L${X(SYNC_US)},${ys} L${X(SYNC_US)},${yb} L${X(ACTIVE_START)},${yb}`,
    parent: line,
  });
  const barUs = ACTIVE_US / BARS;
  let d = `M${X(ACTIVE_START)},${yb}`;
  for (let i = 0; i < BARS; i++) {
    const yl = Y(lumaLevel(1 - i / (BARS - 1)));
    d += ` L${X(ACTIVE_START + i * barUs)},${yl} L${X(ACTIVE_START + (i + 1) * barUs)},${yl}`;
  }
  d += ` L${X(ACTIVE_END)},${yb}`;
  const active = stage.path({ className: "wave", d, parent: line });
  const next = LINE_US;
  const syncB = stage.path({
    className: "wave sync-pulse",
    d: `M${X(ACTIVE_END)},${yb} L${X(next)},${yb} L${X(next)},${ys} L${X(next + SYNC_US)},${ys} L${X(next + SYNC_US)},${yb} L${X(70)},${yb}`,
    parent: line,
  });

  // --- the vertical interval, squashed: 10.5 lines in the same 1400 px ------
  const vsync = stage.path({ className: "wave sync-pulse", d: vsyncPath() });

  // --- beam and labels -------------------------------------------------------
  const flyback = stage.path({
    className: "flyback",
    d: `M${SX + SW},${SY + LINE_H / 2} L${SX},${SY + LINE_H * 1.5}`,
  });
  const vFlyback = stage.path({
    className: "flyback",
    d: `M${SX + SW},${SY + SH - 4} L${SX},${SY + 4}`,
  });
  const beam = el(
    "circle",
    { class: "beam-dot", cx: SX, cy: SY + LINE_H / 2, r: 9, opacity: 0 },
    stage.tokenLayer,
  );

  const hLabel = stage.label({ x: X(66), y: 610, text: "H sync", className: "sync-label" });
  // Centred over the broad pulses (2 lines + 7.5 half-lines in).
  const vLabel = stage.label({
    x: WX + (1400 * (2 + 3.75)) / 10.5,
    y: 610,
    text: "V sync",
    className: "sync-label",
  });
  const lines = stage.label({
    x: SX + SW + 60,
    y: SY + SH / 2,
    text: "× 625",
    anchor: "start",
    className: "count-label",
  });
  for (const l of [hLabel, vLabel, lines]) l.el.setAttribute("opacity", "0");

  // 1. One line: brightness is voltage.
  let t = steps.now();
  steps
    .to(beam, { opacity: 1, duration: 0.15 }, t)
    .to(guides, { opacity: 1, duration: 0.4 }, t)
    .draw(active, { duration: 1.4, ease: "none" }, t)
    .to(beam, { attr: { cx: SX + SW }, duration: 1.4, ease: "none" }, t)
    .to(lineRect, { attr: { width: SW }, duration: 1.4, ease: "none" }, t);
  steps.step();

  // 2. H sync: the pulse that says "back to the left, one line down".
  t = steps.now();
  steps
    .draw(syncB, { duration: 0.5 }, t)
    .draw(syncA, { duration: 0.3 }, t)
    .to(hLabel.el, { opacity: 1, duration: 0.3 }, t + 0.3)
    .draw(flyback, { duration: 0.3 }, t + 0.5)
    .to(
      beam,
      { attr: { cx: SX, cy: SY + LINE_H * 1.5 }, duration: 0.3, ease: "power2.in" },
      t + 0.5,
    );
  steps.step();

  // 3. ...and again, and again.
  t = steps.now();
  steps
    .to(flyback.el, { opacity: 0, duration: 0.2 }, t)
    .to(blockRect, { attr: { height: SH }, duration: 1.2, ease: "none" }, t)
    .to(beam, { attr: { cx: SX + SW, cy: SY + SH - 4 }, duration: 1.2, ease: "none" }, t)
    .to(lines.el, { opacity: 1, duration: 0.3 }, t + 0.6);
  steps.step();

  // 4. V sync: a run of long pulses that says "back to the top".
  t = steps.now();
  steps
    .to(line, { opacity: 0, duration: 0.3 }, t)
    .to(hLabel.el, { opacity: 0, duration: 0.3 }, t)
    .draw(vsync, { duration: 0.9 }, t + 0.2)
    .to(vLabel.el, { opacity: 1, duration: 0.3 }, t + 0.6)
    .draw(vFlyback, { duration: 0.4 }, t + 0.8)
    .to(beam, { attr: { cx: SX, cy: SY + 4 }, duration: 0.4, ease: "power2.in" }, t + 0.8);
  steps.step();
}

/**
 * The PAL field-sync sequence (ITU-R BT.1700): two ordinary lines, then five
 * equalising pulses, five broad pulses and five more equalising pulses at
 * half-line spacing, then a blanked line.
 */
function vsyncPath(): string {
  const total = 10.5 * LINE_US;
  const xScale = 1400 / total;
  const level = (us: number): number => {
    const blank = BLACK_LEVEL;
    if (us < 2 * LINE_US) {
      const p = us % LINE_US;
      if (p < SYNC_US) return SYNC_LEVEL;
      if (p < SYNC_US + BACK_PORCH_US || p > SYNC_US + BACK_PORCH_US + ACTIVE_US) return blank;
      return lumaLevel(0.5);
    }
    const half = LINE_US / 2;
    const u = us - 2 * LINE_US;
    if (u < 5 * half) return u % half < 2.35 ? SYNC_LEVEL : blank; // equalising
    if (u < 10 * half) return u % half < 27.3 ? SYNC_LEVEL : blank; // broad
    if (u < 15 * half) return u % half < 2.35 ? SYNC_LEVEL : blank; // equalising
    return (u - 15 * half) % LINE_US < SYNC_US ? SYNC_LEVEL : blank;
  };
  return plot(WX, WX + 1400, (x) => Y(level((x - WX) / xScale)), 0.5);
}
