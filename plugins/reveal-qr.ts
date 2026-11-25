/**
 * RevealQR: put a "scan this" QR code in the screen margin, outside the slide.
 *
 * Usage on any slide chunk:
 *   <!-- .slide: data-qr="https://stats.compiler-explorer.com/" -->
 *
 * The URL lives as readable text in the slide source; the plugin renders it to
 * an inline SVG QR (so it is styled and scaled by the slide theme, like the
 * anim/ scenes) and pins it to a viewport corner. Optional per-slide overrides:
 *   data-qr-position="bottom-left" | "top-right" | "top-left" | "bottom-right"
 *   data-qr-caption="stats.compiler-explorer.com"   (label under the code)
 *
 * The QR box is appended to <body>, not to the slide: reveal.js applies a CSS
 * transform to .slides, which would both clip the box to the slide area and
 * become the containing block for position:fixed. Living on <body> lets it be
 * truly viewport-fixed in the screen margin, matching the themed logo/threads.
 * Visibility is toggled per navigation so each code shows only on its own slide.
 *
 * SVG generation is async, so we render every QR up front on `ready`; the code
 * itself is a pure function of data-qr and never changes after that.
 */

import type { RevealApi, RevealPlugin } from "reveal.js";
import QRCode from "qrcode";

export interface RevealQROptions {
  /** QR quiet-zone width, in modules. */
  margin?: number;
  /** Foreground (dark module) colour. */
  color?: string;
  /** Background (light module) colour. */
  background?: string;
}

/** A rendered QR box, paired with the slide it belongs to. */
interface QRBox {
  slide: HTMLElement;
  box: HTMLElement;
}

export default function RevealQR(options: RevealQROptions = {}): RevealPlugin {
  const { margin = 1, color = "#151526", background = "#ffffff" } = options;

  return {
    id: "reveal-qr",
    async init(deck: RevealApi) {
      const root = deck.getRevealElement();
      const slides = root ? root.querySelectorAll<HTMLElement>("section[data-qr]") : [];
      const built: QRBox[] = [];

      await Promise.all(
        [...slides].map(async (slide) => {
          const text = slide.dataset.qr;
          if (!text) return;

          let svg: string;
          try {
            svg = await QRCode.toString(text, {
              type: "svg",
              margin,
              color: { dark: color, light: background },
            });
          } catch (e) {
            console.warn(`[reveal-qr] cannot render QR for "${text}"`, e);
            return;
          }

          const box = document.createElement("div");
          const position = slide.dataset.qrPosition || "bottom-right";
          box.className = `qr-code qr-${position}`;
          box.innerHTML = svg;

          if (slide.dataset.qrCaption) {
            const caption = document.createElement("div");
            caption.className = "qr-caption";
            caption.textContent = slide.dataset.qrCaption;
            box.appendChild(caption);
          }

          document.body.appendChild(box);
          built.push({ slide, box });
        }),
      );

      function sync(): void {
        const current = deck.getCurrentSlide();
        for (const { slide, box } of built) {
          box.classList.toggle("qr-visible", slide === current);
        }
      }

      sync();
      deck.on("slidechanged", sync);
    },
  };
}
