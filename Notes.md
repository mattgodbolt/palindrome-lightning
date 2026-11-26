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

## Berlin photo

No freely licensed photo of Brandt at the button exists on Wikimedia Commons
(checked 2026-11-25); press-agency photos exist but would need licensing. The
slide is text only. Free 1967 alternatives if ever wanted: the Deutsche Bundespost
Berlin 1967 Funkausstellung stamp (`File:DBPB 1967 309 Funkausstellung.jpg`,
public domain) and a photo of the 1967 colour TV sign with the Funkturm
(`File:Farbfernsehen 1967.jpg`, CC BY-SA 2.5, Hans Littmann).

## jsbeeb demo options

Researched by a subagent on 2026-11-25; it said it checked each in Chrome.
Change `displayMode=rgb` to `pal` for the other frame. `autoboot` and `autotype`
are mutually exclusive in jsbeeb; `embedBasic` tokenises a listing and RUNs it.

1. MODE 2 colour bars with complementary-coloured " PAL TELLY " text strips,
   via `embedBasic` (no disc, no CORS, ~3 s, strong fringing on the text):
   `https://bbc.xania.org/?embed&displayMode=rgb&embedBasic=10MODE2%3AVDU23%2C1%2C0%3B0%3B0%3B0%3B%0A20FORI%3D0TO7%3AREADC%3AVDU24%2CI%2A160%3B0%3BI%2A160%2B159%3B1023%3B%3AGCOL0%2C128%2BC%3ACLG%3ANEXT%0A30VDU26%3AFORR%3D2TO30STEP4%3AC%3D%28R%20DIV4%29MOD8%3ACOLOUR128%2BC%3ACOLOUR7-C%3APRINTTAB%284%2CR%29%22%20PAL%20%20TELLY%20%22%3B%3ANEXT%0A40REPEATUNTILFALSE%0A50DATA7%2C3%2C6%2C2%2C5%2C1%2C4%2C0%0A`
2. Nyan Cat (Bitshifters, Master): blue background, rainbow, animated, with
   music; depends on bitshifters.github.io:
   `https://bbc.xania.org/?embed&autoboot&model=Master&displayMode=rgb&disc=bitshifters:crtc-beebnyan.ssd`
3. Wobble Colours (Bitshifters 256-byte demo, Master): very garish but fast
   flashing, a photosensitivity concern on a projector:
   `https://bbc.xania.org/?embed&autoboot&model=Master&displayMode=rgb&disc=bitshifters:bs-wobble-colours.ssd`

Rejected: Repton (text on black), Bar Beeb (doesn't autoboot). Check the iframe
at 760x600 for stray debugger panels before using any of these.

## TODO

- Photos of the bench: console, SDR, setup.
- jsbeeb slide: now runs the MODE 2 colour-bars listing (option 1 below). Have
  screenshots as a Wi-Fi fallback.
- The jsbeeb iframes pass `mute`, which hides the "suspended audio" banner once
  https://github.com/mattgodbolt/jsbeeb/pull/1934 is merged and live; until then,
  click each frame before the talk.
- Maybe Firetrack's B&W trick (`../PALindrome/docs/Firetrack_BW_Trick.md`) as a
  15-second aside: it attacks the PAL ident to trip the colour killer. Probably
  no time.
- Rehearse against the clock and cut.
