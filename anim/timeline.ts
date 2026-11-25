/**
 * Steps: a seekable, eased timeline built on GSAP, with a few domain verbs
 * (activate / morphValue / flow) on top of the raw tweens.
 *
 * The model that makes back/forward "just work": there is ONE timeline. The
 * scene script builds it once, top-to-bottom, reading like a storyboard, and
 * calls `.step()` to drop a labelled stop at each point a fragment should pause.
 * Navigation never plays-and-reverses ad hoc - it always `seek(n)`s to an
 * absolute label, so forward, backward and jumping land on the same state
 * deterministically. This is the timeline equivalent of "recompute the whole
 * diagram from the current step index", and it is exactly how Motion Canvas and
 * the old reveal-rat plugin stay correct.
 *
 * Authoring reads as a straight-line script - the coroutine/"await the next
 * beat" feel - without needing a generator runner:
 *
 *   steps
 *     .activate(alb)              // tween the box to its active style
 *     .flow(edge, token)          // fly a dot along an edge
 *     .step()                     // <- fragment stop
 *     .morphValue(cell, "p45");
 */

import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

import type { EdgeHandle, PathHandle, TokenHandle, ValueHandle } from "./stage.js";

gsap.registerPlugin(MotionPathPlugin);

/** GSAP tween variables (opacity, transform, custom properties, motionPath...). */
type TweenVars = gsap.TweenVars;
/** A GSAP timeline position: an absolute time (number) or a label/relative string. */
type Position = number | string;

/** A handle whose `.el` is the element to animate, or a bare element. */
type Activatable = { el: Element } | Element;

const DEFAULT: TweenVars = { duration: 0.6, ease: "power2.inOut" };

/** Resolve an activatable to the element the timeline should tween. */
function elementOf(handle: Activatable): Element {
  return "el" in handle ? handle.el : handle;
}

export class Steps {
  private readonly tl: gsap.core.Timeline;
  private count = 0;
  private _control: gsap.core.Tween | null = null;
  private _step = 0;

  constructor() {
    // lazy:false: GSAP normally defers a tween's first write to the end of the
    // tick. When a seek jumps across several steps at once, a later tween on
    // the same property would then read a stale start value (e.g. a fill that
    // an earlier step changed), so the state at step N would depend on how you
    // got there. Writing immediately keeps every step a pure function of N.
    this.tl = gsap.timeline({ paused: true, defaults: { lazy: false } });
    this.tl.addLabel("step-0", 0);
  }

  /** Mark a fragment stop. The slide will get exactly `stepCount` fragments. */
  step(): this {
    this.count += 1;
    this.tl.addLabel(`step-${this.count}`, this.tl.duration());
    return this;
  }

  get stepCount(): number {
    return this.count;
  }

  /**
   * The current end time of the timeline. Capture this at the top of a step and
   * place that step's tweens at absolute offsets from it (t0, t0+0.2, ...) so
   * timing is explicit and overlaps are deliberate, rather than depending on the
   * fragile "<"/">" insertion-relative positions.
   */
  now(): number {
    return this.tl.duration();
  }

  // --- raw passthroughs (escape hatch / generic use) ---------------------

  to(target: gsap.TweenTarget, vars: TweenVars, at?: Position): this {
    this.tl.to(target, { ...DEFAULT, ...vars }, at);
    return this;
  }

  fromTo(target: gsap.TweenTarget, fromVars: TweenVars, toVars: TweenVars, at?: Position): this {
    this.tl.fromTo(target, fromVars, { ...DEFAULT, ...toVars }, at);
    return this;
  }

  set(target: gsap.TweenTarget, vars: TweenVars, at?: Position): this {
    this.tl.set(target, vars, at);
    return this;
  }

  // --- domain verbs ------------------------------------------------------

  /** Tween a node/box towards its "active" look (CSS uses the --active var). */
  activate(handle: Activatable, vars: TweenVars = {}, at?: Position): this {
    this.tl.to(elementOf(handle), { "--active": 1, ...DEFAULT, ...vars }, at);
    return this;
  }

  deactivate(handle: Activatable, vars: TweenVars = {}, at?: Position): this {
    this.tl.to(elementOf(handle), { "--active": 0, ...DEFAULT, ...vars }, at);
    return this;
  }

  /**
   * Cross-fade a value handle to a new string: the old text slides up and fades
   * out while the new text rises up into its place.
   */
  morphValue(valueHandle: ValueHandle, newText: string, vars: TweenVars = {}, at?: Position): this {
    const oldEl = valueHandle.current;
    const newEl = valueHandle.push(newText);
    const dur = (vars.duration as number | undefined) ?? (DEFAULT.duration as number);
    const ease = vars.ease ?? DEFAULT.ease;
    const dy = (vars.slide as number | undefined) ?? 10;
    const pos: Position = at ?? ">";
    // Old value rises out of the way and fades; new value rises into its place.
    // Both are property tweens on persistent elements, so a backward seek simply
    // un-does them and the previous value reappears.
    this.tl.to(oldEl, { opacity: 0, y: -dy, ease, duration: dur }, pos);
    this.tl.fromTo(newEl, { opacity: 0, y: dy }, { opacity: 1, y: 0, ease, duration: dur }, pos);
    valueHandle.current = newEl;
    return this;
  }

  /**
   * Fly a token along an edge: fade in at the source, ride the path, fade out at
   * the destination. The motion reverses cleanly on backward seek.
   */
  flow(edge: EdgeHandle, token: TokenHandle, vars: TweenVars = {}, at?: Position): this {
    const dur = (vars.duration as number | undefined) ?? 0.9;
    const ease = vars.ease ?? "power1.inOut";
    const reverse = (vars.reverse as boolean | undefined) ?? false;
    // Resolve the start to an absolute time so the motion and the fade-in begin
    // together. If they don't, the token fades in at its untransformed origin
    // (0,0) before the motion places it on the path, and you see it flash there.
    const start = typeof at === "number" ? at : this.tl.duration();
    this.tl.to(
      token.el,
      {
        duration: dur,
        ease,
        motionPath: {
          path: edge.path,
          alignOrigin: [0.5, 0.5],
          start: reverse ? 1 : 0,
          end: reverse ? 0 : 1,
        },
      },
      start,
    );
    this.tl.to(token.el, { opacity: 1, duration: 0.15, ease: "none" }, start);
    this.tl.to(token.el, { opacity: 0, duration: 0.15, ease: "none" }, start + dur - 0.15);
    return this;
  }

  /**
   * Draw a path on, as if by a pen (or an electron beam). The path is
   * normalised to pathLength=1 and hidden at build time, so step 0 shows
   * nothing; the tween then moves the dash offset. `vars.from` / `vars.to`
   * draw a partial span as a fraction of the length (0..1), so one long path
   * can be drawn on in several steps.
   */
  draw(handle: PathHandle | EdgeHandle, vars: TweenVars = {}, at?: Position): this {
    const path = handle.path;
    const { from = 0, to = 1, ...rest } = vars as TweenVars & { from?: number; to?: number };
    if (!path.hasAttribute("pathLength")) {
      // Gap of 2 so no stray dash shows at either end of a partly drawn path.
      path.setAttribute("pathLength", "1");
      path.style.strokeDasharray = "1 2";
      path.style.strokeDashoffset = "1";
    }
    this.tl.fromTo(
      path,
      { strokeDashoffset: 1 - from },
      { strokeDashoffset: 1 - to, ...DEFAULT, ease: "none", ...rest },
      at,
    );
    return this;
  }

  // --- navigation --------------------------------------------------------

  /**
   * Seek to a step. `stepIndex` comes straight from reveal's fragment index + 1
   * (fragment -1, i.e. nothing shown yet, maps to step 0 - the initial state).
   * Animated by default; pass {animate:false} to snap (e.g. when jumping into
   * the slide from elsewhere in the deck).
   */
  seek(stepIndex: number, { animate = true }: { animate?: boolean } = {}): this {
    const n = Math.max(0, Math.min(stepIndex, this.count));
    const label = `step-${n}`;
    this._control?.kill();
    // Only animate an adjacent step: stepping one fragment forward or back on the
    // visible slide. Any larger jump - entering or leaving a slide, a deep-link -
    // snaps, so we never replay a whole timeline behind a slide transition.
    if (animate && Math.abs(n - this._step) === 1) {
      this._control = this.tl.tweenTo(label, { ease: "none" });
    } else {
      this.tl.seek(label);
    }
    this._step = n;
    return this;
  }
}
