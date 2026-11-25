/**
 * lint-staged configuration.
 *
 * Two tasks run on a commit:
 *  - Prettier formats every staged file (matched by filename).
 *  - `tsc --noEmit` type-checks the whole TypeScript project when any .ts /
 *    .d.ts file is staged. It is expressed as a function returning a bare
 *    command so lint-staged does NOT append the matched filenames: passing
 *    files to `tsc` makes it ignore tsconfig.json (and thus strict, lib, the
 *    include list), which is exactly the setup we are moving away from. The
 *    whole-project check is fast for a repo this size and blocks the commit on
 *    any type error.
 */
export default {
  "*": "prettier --write --ignore-unknown",
  "*.{ts,tsx}": () => "tsc --noEmit",
};
