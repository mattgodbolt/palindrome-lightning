/**
 * RevealScene: the bridge between reveal.js navigation and a Steps timeline.
 *
 * Usage in a slide:
 *   <div class="scene" data-scene="rat"></div>
 * data-scene="rat" loads scenes/rat.ts and uses its default export. To keep
 * several related scenes (sharing helpers) in one file, name the export:
 *   <div class="scene" data-scene="lifecycle:read"></div>   // scenes/lifecycle.ts, export `read`
 * The host deck just lists the plugin (RevealScene()) - no per-scene wiring.
 *
 * For each scene container it:
 *   1. creates an <svg> and a Stage + Steps,
 *   2. runs the factory to build the storyboard (which calls steps.step()),
 *   3. injects exactly `stepCount` invisible reveal fragments into the slide so
 *      reveal has the right number of forward/back stops, then re-syncs,
 *   4. on every navigation event, seeks the timeline to `getIndices().f + 1`.
 *
 * The author never writes a fragment by hand and never writes reverse logic:
 * the step count comes from the storyboard, and seeking to an absolute label
 * handles forward, backward and jumping identically.
 */

import type { RevealApi, RevealPlugin } from "reveal.js";

import { Stage } from "./stage.js";
import { Steps } from "./timeline.js";

const SVGNS = "http://www.w3.org/2000/svg";

/** What a scene factory is handed to build its storyboard. */
export interface SceneContext {
  stage: Stage;
  steps: Steps;
  container: HTMLElement;
  deck: RevealApi;
}

/** A scene: a default- or named-exported factory in scenes/<file>.ts. */
export type SceneFactory = (ctx: SceneContext) => void;

/** Per-container state, once a scene has been built into it. */
interface SceneRecord {
  steps: Steps;
  section: HTMLElement;
}

export default function RevealScene(): RevealPlugin {
  return {
    id: "reveal-scene",
    init(deck: RevealApi) {
      const built: HTMLElement[] = [];
      // Per-element bookkeeping, kept off the DOM nodes themselves so nothing
      // needs to widen the DOM types: which containers have a scene, and which
      // sections have already had their fragments injected.
      const scenes = new WeakMap<HTMLElement, SceneRecord>();
      const injected = new WeakSet<HTMLElement>();
      // Captured before reveal reads the URL: on a deep-link/reload to #/h/v/f,
      // reveal strips the fragment (it clamps to -1 because our fragments don't
      // exist yet) and rewrites the hash to #/h/v. So we snapshot the original
      // hash here, while it still carries the requested fragment.
      const initialHash = window.location.hash;

      async function build(container: HTMLElement): Promise<void> {
        if (scenes.has(container)) return;
        const scene = container.dataset.scene;
        if (!scene) return;
        const [file, exportName = "default"] = scene.split(":");
        let factory: SceneFactory | undefined;
        try {
          const module = (await import(`../scenes/${file}.ts`)) as Record<string, unknown>;
          factory = module[exportName] as SceneFactory | undefined;
        } catch (e) {
          console.warn(`[reveal-scene] cannot load scenes/${file}.ts`, e);
          return;
        }
        if (typeof factory !== "function") {
          console.warn(`[reveal-scene] scenes/${file}.ts has no export "${exportName}"`);
          return;
        }
        const viewBox = container.dataset.viewbox || "0 0 1000 560";
        const svg = document.createElementNS(SVGNS, "svg");
        svg.setAttribute("viewBox", viewBox);
        svg.setAttribute("class", "scene-svg");
        container.appendChild(svg);

        const stage = new Stage(svg);
        const steps = new Steps();
        factory({ stage, steps, container, deck });

        const section = container.closest("section");
        if (section) injectFragments(section, steps.stepCount);

        scenes.set(container, { steps, section: section ?? container });
        built.push(container);
      }

      function injectFragments(section: HTMLElement, n: number): void {
        if (injected.has(section)) return;
        for (let i = 0; i < n; i++) {
          const span = document.createElement("span");
          span.className = "fragment scene-fragment";
          span.dataset.fragmentIndex = String(i);
          section.appendChild(span);
        }
        injected.add(section);
      }

      function seekFor(container: HTMLElement, opts?: { animate?: boolean }): void {
        const record = scenes.get(container);
        if (!record) return;
        const onCurrent = record.section === deck.getCurrentSlide();
        const f = onCurrent ? deck.getIndices().f : -1;
        record.steps.seek(f + 1, opts);
      }

      // One handler for every navigation event: seek each scene to its target
      // step. Steps.seek animates only an adjacent step (stepping a fragment on
      // the visible slide) and snaps larger jumps, so entering or leaving a slide
      // never replays a whole timeline behind the fade transition.
      function onNav(): void {
        for (const c of built) seekFor(c, { animate: true });
      }

      // On load/reload/deep-link, reveal reads the URL hash before our fragments
      // exist, so it clamps the requested fragment to -1. Once we've injected the
      // fragments we re-read the hash and navigate reveal to the intended one, so
      // a reload at #/h/v/f restores the animation to that step.
      function restoreFragmentFromHash(): void {
        const slide = deck.getCurrentSlide();
        const nFrag = slide ? slide.querySelectorAll(".scene-fragment").length : 0;
        if (!nFrag) return;
        const segs = (initialHash.match(/\d+/g) || []).map(Number);
        // The hash is /h or /h/v; the fragment (if any) is the segment right
        // after the slide part. A vertical sub-slide's parent is a <section>.
        const slideSegs = slide.parentElement?.tagName === "SECTION" ? 2 : 1;
        if (segs.length <= slideSegs) return;
        const { h, v } = deck.getIndices();
        const f = Math.max(-1, Math.min(segs[slideSegs], nFrag - 1));
        deck.slide(h, v, f);
      }

      deck.on("ready", async () => {
        const root = deck.getRevealElement();
        const containers = root ? root.querySelectorAll<HTMLElement>("[data-scene]") : [];
        await Promise.all([...containers].map(build));
        if (!built.length) return;
        deck.sync();
        restoreFragmentFromHash();
        // Snap to the correct state (matching the restored fragment) without an
        // opening animation.
        for (const c of built) seekFor(c, { animate: false });
      });

      deck.on("fragmentshown", onNav);
      deck.on("fragmenthidden", onNav);
      deck.on("slidechanged", onNav);
    },
  };
}
