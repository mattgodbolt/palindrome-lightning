/**
 * PALindrome's signal chain, which is a 1980s television's signal chain, lit up
 * stage by stage at breakneck pace. Mirrors the flowchart in PALindrome's
 * README.
 */

import type { SceneContext } from "../anim/reveal-scene.js";
import { layoutDag } from "../anim/layout.js";

export default function ({ stage, steps }: SceneContext): void {
  const g = layoutDag(stage, {
    rankdir: "LR",
    ranksep: 70,
    nodesep: 40,
    nodes: {
      sdr: { title: "SDR", className: "store" },
      saw: { title: "SAW filter" },
      agc: { title: "AGC" },
      sync: { title: "Sync sep." },
      hflywheel: { title: "H flywheel" },
      vflywheel: { title: "V flywheel" },
      chroma: { title: "PAL decoder" },
      killer: { title: "Colour killer" },
      crt: { title: "CRT", className: "store" },
    },
    edges: [
      ["sdr", "saw"],
      ["saw", "agc"],
      ["agc", "sync"],
      ["agc", "chroma"],
      ["sync", "hflywheel"],
      ["sync", "vflywheel"],
      ["chroma", "killer"],
      ["hflywheel", "crt"],
      ["vflywheel", "crt"],
      ["killer", "crt"],
    ],
  });

  const beats: string[][] = [
    ["sdr"],
    ["saw", "agc"],
    ["sync", "hflywheel", "vflywheel"],
    ["chroma", "killer"],
    ["crt"],
  ];
  for (const beat of beats) {
    const t = steps.now();
    beat.forEach((id, i) => steps.activate(g.n[id], { duration: 0.3 }, t + i * 0.1));
    steps.step();
  }
}
