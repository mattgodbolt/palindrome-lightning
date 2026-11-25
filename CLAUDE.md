# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

Matt Godbolt's **five-minute lightning talk on PAL** and
[PALindrome](https://github.com/mattgodbolt/PALindrome), for Meeting C++ 2026 in
Berlin. Delivered at comedy breakneck pace, so slides are fast and visual: lots
of animated scenes, very few words.

The arc: how a CRT works, how the black-and-white signal drives it (H sync,
V sync), the trick that sneaks colour in, why PAL beats NTSC (and that it
launched in Berlin, IFA 1967), why Matt cares (jsbeeb's PAL simulation), and how
that got out of hand (PALindrome: an SDR plus a software model of a whole 1980s
television).

**Start here:** [`Notes.md`](Notes.md) has the outline, facts and their sources.

Related repos (siblings of this one): `../PALindrome` (the decoder; its README and
`docs/` are the source for the signal-chain slides), `../jsbeeb`
(https://bbc.xania.org, `?displayMode=pal` vs `rgb`).

Scaffolded from `../aoco-cppcon2026-talk`: same build, HRT theme and `anim/`
toolkit, without the CppCon artwork or `reveal-ce`.

## Technical Setup

- **Build**: Vite (`npm start` for dev with autoreload, `npm run build`)
- **Framework**: reveal.js (npm dependency)
- **Diagrams**: the `anim/` toolkit (seekable SVG scenes). See [`anim/README.md`](anim/README.md).
  This talk added `stage.path()` and `steps.draw()` for waveforms and beams.
- **Styling**: `style.less` (LESS, compiled by Vite) + `hrt-theme.css`

## Project Structure

```
├── index.html      # reveal.js config, title slide, slide orchestration
├── slides/         # the slides (markdown, one file per topic)
├── scenes/         # animated scenes: crt, scan, colour, pal, chain (+ lib.ts helpers)
├── anim/           # the seekable-diagram toolkit (see anim/README.md)
├── plugins/        # reveal-qr.ts (QR codes in the margin)
├── images/         # HRT logo, favicon, PALindrome output
├── style.less      # custom styling (LESS)
├── hrt-theme.css   # theme colours / typography
```

## Working with Slides

- One markdown file per topic, each wired up as its own `<section>` in
  `index.html`. Slides within a topic are separated vertically by `---`.
- Speaker notes use the `Notes:` prefix at the bottom of a chunk.
- Slide-level attributes: `<!-- .slide: class="foo" -->` as the first line of the chunk.
- A scene: `<div class="scene wide" data-scene="scan" data-viewbox="0 0 1600 880"></div>`
  loads `scenes/scan.ts`. Each `steps.step()` is one key press.

## Scenes

- Signal timings and levels in `scenes/lib.ts` are the real 625-line PAL
  numbers. The subcarrier is deliberately slowed (`CARTOON_SUBCARRIER`) so the
  wiggle is visible; the colour slide says so on screen. Keep it that way: be
  accurate except where the slide admits the cartoon.
- Scenes must stay seekable: create every element up front, only tween
  properties (see `anim/README.md`).

## Slide Style

- **No em-dashes in slide body content.** Use a period, comma, parens, or rewrite.
- Unfinished slides use the bright-red `.todo` class (and `.todo-inline`).
- British English throughout. The audience is European; avoid US-centric framing.
- Speaker notes as prose, not bullet points.
- Five minutes total: cut words before cutting animations.

## Research & Notes Conventions

- Plain factual notes, cite a source for every claim, flag anything unverified.
