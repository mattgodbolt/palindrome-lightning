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
import { css, el, plot, rgbToYuv, uniqueId, yuvToRgb } from "./lib.js";

const CX = 400;
const CY = 390;
const SCALE = 1200; // px per unit of U/V
const ERROR_DEG = 40;
const CAPTION_Y = 680;

// Lead-in: the subcarrier as a dot going round a circle, drawing its wave.
const WAVE_X = 860;
const WAVE_W = 620;
const WAVE_CYCLES = 2;
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

  // --- the wheel (hidden until the lead-in has explained the angle) ---------
  const ring = el("g", { opacity: 0 }, back);
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
      ring,
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

  // --- the screen (hidden until the lead-in is done) -------------------------
  const screen = el("g", { opacity: 0 }, back);
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
    screen,
  );
  stage.label({
    x: CHIP_X + 60,
    y: LINES_Y + N_LINES * LINE_H + 40,
    text: "sent",
    className: "swatch-label",
    parent: screen,
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
    screen,
  );
  const oddLines: SVGRectElement[] = [];
  const evenLines: SVGRectElement[] = [];
  for (let i = 0; i < N_LINES; i++) {
    const r = el(
      "rect",
      { x: LINES_X, y: LINES_Y + i * LINE_H, width: LINES_W, height: LINE_H - 3, fill: css(SKIN) },
      screen,
    );
    (i % 2 ? evenLines : oddLines).push(r);
  }
  stage.label({
    x: LINES_X + LINES_W / 2,
    y: LINES_Y + N_LINES * LINE_H + 40,
    text: "on screen, line by line",
    className: "swatch-label",
    parent: screen,
  });

  // --- captions: one title + one line per beat, cross-faded ------------------
  const make = (text: string, yy: number, cls: string) => {
    const l = stage.label({ x: 1180, y: yy, text, className: cls });
    l.el.setAttribute("opacity", "0");
    return l.el;
  };
  let shown: SVGTextElement[] = [];
  const caption = (t: number, title: string | null, sub: string, subClass = "") => {
    const next: SVGTextElement[] = [make(sub, CAPTION_Y + 62, `side-label ${subClass}`)];
    if (title) next.unshift(make(title, CAPTION_Y, "pal-title"));
    const keep = title ? [] : shown.filter((e) => e.classList.contains("pal-title"));
    for (const e of shown) if (!keep.includes(e)) steps.to(e, { opacity: 0, duration: 0.25 }, t);
    for (const e of next) steps.to(e, { opacity: 1, duration: 0.3 }, t + 0.2);
    shown = [...keep, ...next];
  };

  // --- lead-in: phase is an angle ---------------------------------------------
  // A dot going round the circle at the subcarrier frequency traces the wave
  // to its right. The burst, continued, is the reference (drawn at 0 degrees:
  // a cartoon, as real PAL burst sits at 135/225 and the set derives its U/V
  // references from it, but the idea is the same); the
  // colour wiggle is the same frequency but ahead by theta. That lead, read
  // as an angle, is the hue. The circle's radius is the arrow length, so the
  // colour dot ends up exactly at the tip of the arrow that follows.
  const lead = el("g", {}, back);
  const circle = el("circle", { class: "phase-circle", cx: CX, cy: CY, r: len, opacity: 0 }, lead);
  const wave = (phase: number, cls: string) => {
    const clipId = uniqueId("wave");
    const clip = el("clipPath", { id: clipId }, lead);
    const reveal = el("rect", { x: WAVE_X - 10, y: 0, width: 0, height: 800 }, clip);
    const k = (2 * Math.PI * WAVE_CYCLES) / WAVE_W;
    const path = el(
      "path",
      {
        class: `wave ${cls}`,
        d: plot(WAVE_X, WAVE_X + WAVE_W, (x) => CY - len * Math.sin(k * (x - WAVE_X) + phase)),
        "clip-path": `url(#${clipId})`,
      },
      lead,
    );
    return { path, reveal };
  };
  const dot = (cls: string, phase: number) => {
    const outer = el("g", { transform: `translate(${CX},${CY})` }, lead);
    const spin = el("g", {}, outer);
    el("circle", { class: `phase-dot ${cls}`, cx: len, cy: 0, r: 14 }, spin);
    gsap.set(spin, { svgOrigin: "0 0", rotation: rot(phase), opacity: 0 });
    return spin;
  };
  const refWave = wave(0, "reference");
  const colWave = wave(theta, "chroma");
  const refDot = dot("reference", 0);
  const colDot = dot("chroma", theta);
  const arcR = 70;
  const phaseArc = el(
    "path",
    {
      class: "phase-arc",
      d: `M${CX + arcR},${CY} A${arcR},${arcR} 0 0 0 ${CX + arcR * Math.cos(theta)},${CY - arcR * Math.sin(theta)}`,
      opacity: 0,
    },
    lead,
  );
  const phaseLabel = stage.label({
    x: CX + 115 * Math.cos(theta / 2),
    y: CY - 115 * Math.sin(theta / 2),
    text: `${Math.round((theta * 180) / Math.PI)}°`,
    className: "phase-label",
  });
  phaseLabel.el.setAttribute("opacity", "0");
  const spinDuration = 1.8;
  const turns = -360 * WAVE_CYCLES;

  // 1. The burst: the reference wiggle. Once round the circle is one cycle.
  let t = steps.now();
  steps
    .to(circle, { opacity: 1, duration: 0.3 }, t)
    .to(refDot, { opacity: 1, duration: 0.2 }, t)
    .to(refDot, { rotation: turns, duration: spinDuration, ease: "none" }, t)
    .to(refWave.reveal, { attr: { width: WAVE_W + 20 }, duration: spinDuration, ease: "none" }, t);
  caption(t, "Phase is an angle", "the burst, continued: one cycle = once round");
  steps.step();

  // 2. The colour wiggle: same speed, but ahead. How far ahead is an angle.
  t = steps.now();
  steps
    .to(colDot, { opacity: 1, duration: 0.2 }, t)
    .to(colDot, { rotation: rot(theta) + turns, duration: spinDuration, ease: "none" }, t)
    .to(colWave.reveal, { attr: { width: WAVE_W + 20 }, duration: spinDuration, ease: "none" }, t)
    .to(phaseArc, { opacity: 1, duration: 0.3 }, t + spinDuration)
    .to(phaseLabel.el, { opacity: 1, duration: 0.3 }, t + spinDuration)
    .to(sent.arrow, { opacity: 1, duration: 0.3 }, t + spinDuration);
  caption(t, null, "colour: same wiggle, a third of a cycle ahead");
  steps.step();

  // 3. ...and that angle IS the hue; the length is the saturation.
  t = steps.now();
  steps
    .to([refWave.path, colWave.path, circle, refDot, colDot], { opacity: 0, duration: 0.4 }, t)
    .to([phaseArc, phaseLabel.el], { opacity: 0, duration: 0.4 }, t)
    .to(ring, { opacity: 1, duration: 0.6 }, t + 0.2)
    .to(screen, { opacity: 1, duration: 0.6 }, t + 0.2);
  caption(t, "Colour is an arrow", "angle = hue, length = saturation");
  steps.step();

  // --- the phase error, drawn as an arc beside the arrow it nudges ------------
  // Both arcs go in their arrow's MIRROR group, not the rotating arrow, so the
  // even-line arc flips with the V flip: on air it points the same way as the
  // odd-line arc (the error doesn't care what's being sent), and once the set
  // flips the line back, it visibly points the other way.
  const errR = len + 30;
  const at = (a: number) => `${errR * Math.cos(a)},${-errR * Math.sin(a)}`;
  const oddArc = stage.path({
    className: "error-arc",
    d: `M${at(theta)} A${errR},${errR} 0 0 0 ${at(theta + err)}`, // anticlockwise
    parent: odd.mirror,
  });
  // Pre-mirror coordinates: theta -> theta - err (clockwise) shows on air,
  // mirrored, as -theta -> -theta + err (anticlockwise, like the odd line).
  const evenArc = stage.path({
    className: "error-arc",
    d: `M${at(theta)} A${errR},${errR} 0 0 1 ${at(theta - err)}`,
    parent: even.mirror,
  });
  const notYet = "rgb(55, 55, 70)";

  // 4. NTSC: a phase error on the way rotates every line the same way.
  t = steps.now();
  steps
    .to(odd.arrow, { opacity: 1, duration: 0.2 }, t)
    .draw(oddArc, { duration: 0.8 }, t)
    .to(odd.arrow, { rotation: rot(theta + err), duration: 0.8 }, t)
    .to([...oddLines, ...evenLines], { fill: colourAt(theta + err), duration: 0.8 }, t);
  caption(t, "NTSC: Never The Same Colour", "phase error: every line the wrong hue");
  steps.step();

  // 5. PAL. Odd lines are sent exactly as NTSC sends every line, so they are
  //    still wrong. Say so, or the audience assumes PAL fixes every line.
  t = steps.now();
  steps.to(evenLines, { fill: notYet, duration: 0.5 }, t);
  caption(t, "PAL: Phase Alternating Line", "odd lines: just like NTSC. Still wrong!", "odd-line");
  steps.step();

  // 6. Even lines: the studio sends V upside down (a mirror in the U axis).
  t = steps.now();
  steps
    .to(even.arrow, { opacity: 1, duration: 0.2 }, t)
    .to(even.mirror, { scaleY: -1, duration: 0.7 }, t);
  caption(t, null, "even lines: sent with V flipped", "even-line");
  steps.step();

  // 7. The same error hits the flipped line, rotating it the same way.
  t = steps.now();
  steps
    .draw(evenArc, { duration: 0.8 }, t)
    .to(even.arrow, { rotation: rot(theta - err), duration: 0.8 }, t);
  caption(t, null, "same error, same direction", "even-line");
  steps.step();

  // 8. The set flips it back: now that line is wrong the OTHER way.
  t = steps.now();
  steps
    .to(even.mirror, { scaleY: 1, duration: 0.7 }, t)
    .to(evenLines, { fill: colourAt(theta - err), duration: 0.6 }, t + 0.3);
  caption(t, null, "flip it back: wrong the OTHER way!", "even-line");
  steps.step();

  // 9. Average adjacent lines: right hue, slightly less saturated.
  t = steps.now();
  steps
    .to([odd.arrow, even.arrow, oddArc.el, evenArc.el], { opacity: 0.3, duration: 0.4 }, t)
    .to(avg.arrow, { opacity: 1, scale: Math.cos(err), duration: 0.6 }, t)
    .to(
      [...oddLines, ...evenLines],
      { fill: colourAt(theta, mag * Math.cos(err)), duration: 0.6 },
      t,
    );
  caption(t, null, "average odd + even: the errors cancel");
  steps.step();
}
