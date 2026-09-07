# Brinkwood SCSS

Identity rules are emitted under `.brinkwood`. Character owns its layout, keyboard focus treatment, and one form-level vertical scroll surface; Mask and Item own their corresponding sheet scroll roots.

`scss/` is the source of truth; `styles/blades.css` is the committed generated stylesheet.

## Ownership map

- `import/sheet-tabs.scss` owns reusable tab colors, hover, focus, active, transition visuals, and bounded active-panel scrolling; sheet files own sizing and geometry.
- `import/general-styles.scss` imports shared tab styling.
- `import/sheet-identity.scss` owns shared identity fields, portraits, rows, and trackers across Character and Mask sheets.
- `import/tooltip.scss` owns generic tooltip chrome; content-only identity triggers opt out through `.tooltip-trigger--plain` so tooltip behavior cannot change component geometry.
- `import/character-sheet.scss` owns Character layout, geometry, scrolling, and focus treatment.
- `import/legacy-character-effects.scss` and `import/legacy-character-sheet-polish.scss` contain only late decoration and native-control compatibility. They must not own geometry, scrolling, or focus. Shared `.bw-checkbox-x` visuals live in `import/general-styles.scss`; sheets own only size and placement.

Prefer a shared primitive when controls repeat across sheets. Keep rules DRY, but do not create abstractions for a single sheet-specific layout rule: the clearest single owner wins.

Shared component geometry and state contracts are documented in `../docs/sheet-design-system.md`.

## Build and parity

Install the pinned local dependencies from the repository root:

    pnpm install --frozen-lockfile

Build the committed stylesheet:

    pnpm run build:css

Verify that the committed stylesheet exactly matches SCSS source:

    pnpm run check:css

The parity check normalizes only CRLF versus LF before comparison, because
Sass writes platform line endings and Windows checkouts may use
`core.autocrlf`. Any other generated CSS difference still fails the check.

`@parcel/watcher` is an optional Sass filesystem watcher. Its build is explicitly disabled in `pnpm-workspace.yaml`; Brinkwood's one-shot CSS build does not use it.
