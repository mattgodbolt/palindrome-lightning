# PALindrome: a lightning talk about PAL

A five-minute lightning talk about PAL television, and
[PALindrome](https://github.com/mattgodbolt/PALindrome).

Presented at Meeting C++ 2026, Berlin.

## Development

```bash
npm install
npm start          # Dev server with autoreload
npm run build      # Production build
npm run preview    # Preview production build
npm run fmt        # Format with prettier
```

## Structure

- `Notes.md`: outline, facts and sources, TODOs
- `slides/*.md`: the slides (reveal.js markdown, one file per topic)
- `scenes/*.ts`: the animated scenes (CRT, scanning, colour, PAL phasors, signal chain)
- `index.html`: reveal.js config and slide wiring
- `anim/`: the seekable-diagram toolkit (see `anim/README.md`)
- `style.less` / `hrt-theme.css`: styling, colours and typography
