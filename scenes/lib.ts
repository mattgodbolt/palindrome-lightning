/**
 * Shared helpers for the PAL scenes: raw SVG elements the Stage has no
 * primitive for, PAL line timing, and colour maths.
 *
 * Timings and levels are the real 625-line PAL numbers; the colour subcarrier
 * frequency is NOT (see CARTOON_SUBCARRIER) because 230 cycles across a slide
 * would be a grey smear.
 */

const SVGNS = "http://www.w3.org/2000/svg";

export function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  parent: Element | null = null,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (parent) parent.appendChild(node);
  return node;
}

let uid = 0;
/** A document-unique id, for clipPaths (several scenes share one document). */
export function uniqueId(prefix: string): string {
  return `${prefix}-${++uid}`;
}

// --- PAL line timing, microseconds (ITU-R BT.470 / BT.1700) -----------------
export const LINE_US = 64;
export const SYNC_US = 4.7;
export const BACK_PORCH_US = 5.7;
export const FRONT_PORCH_US = 1.65;
export const ACTIVE_US = LINE_US - SYNC_US - BACK_PORCH_US - FRONT_PORCH_US; // ~52
/** Burst starts 5.6 us after the sync leading edge and lasts ~10 cycles (2.25 us). */
export const BURST_START_US = 5.6;
export const BURST_US = 2.25;

// --- levels, as a fraction of sync-tip-to-peak-white ------------------------
export const SYNC_LEVEL = 0;
export const BLACK_LEVEL = 0.3;
export const WHITE_LEVEL = 1.0;

/** Luma (0..1) to signal level. */
export const lumaLevel = (y: number): number => BLACK_LEVEL + (WHITE_LEVEL - BLACK_LEVEL) * y;

/**
 * Subcarrier cycles per microsecond used in the drawings. Real PAL is
 * 4.43361875; this is slowed down so the wiggle is visible on a projector.
 */
export const CARTOON_SUBCARRIER = 0.6;

// --- colour ------------------------------------------------------------------
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function rgbToYuv({ r, g, b }: Rgb): { y: number; u: number; v: number } {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  return { y, u: 0.493 * (b - y), v: 0.877 * (r - y) };
}

export function yuvToRgb(y: number, u: number, v: number): Rgb {
  const r = y + v / 0.877;
  const b = y + u / 0.493;
  const g = (y - 0.299 * r - 0.114 * b) / 0.587;
  return { r, g, b };
}

export function css({ r, g, b }: Rgb): string {
  const c = (x: number) => Math.round(255 * Math.min(1, Math.max(0, x)));
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

/** EBU 75% colour bars, left to right. */
export const COLOUR_BARS: Rgb[] = [
  [1, 1, 1],
  [0.75, 0.75, 0],
  [0, 0.75, 0.75],
  [0, 0.75, 0],
  [0.75, 0, 0.75],
  [0.75, 0, 0],
  [0, 0, 0.75],
  [0, 0, 0],
].map(([r, g, b]) => ({ r, g, b }));

/** Build an SVG path `d` from a sampled function over [x0, x1]. */
export function plot(x0: number, x1: number, f: (x: number) => number, stepPx = 1): string {
  const pts: string[] = [];
  for (let x = x0; x <= x1; x += stepPx) pts.push(`${x.toFixed(1)},${f(x).toFixed(1)}`);
  return `M${pts.join("L")}`;
}
