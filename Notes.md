# Notes

Five-minute lightning talk, Meeting C++ 2026, Berlin. Comedy breakneck pace.

## Outline (with rough timings)

1. Title (5s)
2. How a CRT works: gun, magnets, phosphor (`scenes/crt.ts`) (30s)
3. The signal: one line, H sync, the whole raster, V sync (`scenes/scan.ts`) (50s)
4. Colour: luma, subcarrier, burst (`scenes/colour.ts`) (40s)
5. PAL vs NTSC phasors (`scenes/pal.ts`) (40s)
6. Berlin, 25 August 1967 (20s)
7. Why I care: jsbeeb RGB vs PAL (30s)
8. It got out of hand: photos, PALindrome chain (`scenes/chain.ts`), Wonder Boy GIF (60s)
9. Danke (5s)

That's ~4m40s. It will be tight.

## Facts and sources

- **PAL line timing**: 64 us line, 4.7 us sync, 5.7 us back porch, 1.65 us
  front porch, ~52 us active; burst at 5.6 us, ~10 cycles. ITU-R BT.470 / BT.1700.
- **Field sync**: 5 equalising, 5 broad, 5 equalising pulses at half-line
  spacing. ITU-R BT.1700.
- **Subcarrier**: 4.43361875 MHz.
- **Brandt / IFA 1967**: colour TV launched at the 25th Funkausstellung in West
  Berlin, 25 August 1967, ~10:57, Willy Brandt (then foreign minister) pressing a
  big red button. The button was a dummy, and the broadcast went to colour a few
  seconds before he pressed it.
  Sources: https://en.wikipedia.org/wiki/1967_in_German_television ,
  https://www.cio.de/article/3688145/als-das-fernsehen-bunt-wurde.html ,
  hannover.de "Farbfernsehen PAL" page.
  Unverified: who started it early (often told as "a technician"). Don't say who.
- **PAL inventor**: Walter Bruch, Telefunken, Hannover. (Not yet sourced here.)
- **jsbeeb**: `https://bbc.xania.org/?displayMode=pal` vs `displayMode=rgb`;
  implementation in `../jsbeeb/src/video-filters/pal-composite.js`.
- **PALindrome**: signal chain from `../PALindrome/README.md`. Wonder Boy III
  GIF is `../PALindrome/docs/images/wb3.gif` (10 fps, palette-dithered).

## TODO

- Photo of Brandt at the button (check licence; Bundesarchiv on Wikimedia Commons is a likely source).
- Photos of the bench: console, SDR, setup.
- jsbeeb slide: pick a demo that shows PAL artefacts well (autoboot a disc, or
  `autotype` a MODE 2 colour-bar program); have screenshots as a Wi-Fi fallback.
- Maybe Firetrack's B&W trick (`../PALindrome/docs/Firetrack_BW_Trick.md`) as a
  15-second aside: it attacks the PAL ident to trip the colour killer. Probably
  no time.
- Rehearse against the clock and cut.
