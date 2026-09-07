# Browser regression fixture

## Character interaction regression

Open `character-interaction-fixture.html` and select **Run assertions**. It uses
native checkbox/radio default actions and the production Character, loadout,
and view-state handlers. Assertions cover first-click legacy loadout adoption,
one final render, immediate clock artwork/counter updates, and unchanged form
scroll through loadout and effect actions. Its minimal replacement adapter
follows Foundry v13's focus-then-scroll part synchronization contract; it does
not replace testing real Actor updates and socket delivery in a running world.

Character declares its root form in `PARTS.sheet.scrollable`, so Foundry
restores that form's scroll during replacement, before render listeners run.
Pointer focus on Character buttons, checkboxes, and radios uses `preventScroll`;
text caret placement and keyboard navigation retain their native behavior.

Start the checkout server with `pnpm run test:browser`, then open
[the fixture](http://127.0.0.1:4173/tests/browser/browser-regression-fixture.html).
It binds only to loopback and serves current checkout files; no Foundry
installation is changed. Stop it with Ctrl+C. `BRINKWOOD_TEST_PORT` overrides 4173.
The baseline stylesheet comes from HEAD; fonts use the same asset paths as
the candidate stylesheet. Capture waits for fonts before measuring geometry.


`browser-regression-fixture.html` is a dependency-free native-DOM harness for
browser checks that Node tests cannot provide. It imports the production
`sheet-dom`, `item-picker-dialog`, and `sheet-view-state` helpers and exposes
all results in the visible `#browser-regression-results` element and the
fixture sections' `data-status` attributes.

## Running with CUA

Serve the workspace or installed-system copy from the existing Foundry test
world host, then open the fixture URL with CUA. The route is environment-owned:
when Foundry serves system files it is normally
`/systems/brinkwood-reforged/tests/browser/browser-regression-fixture.html`; otherwise
map the repository `tests/browser/` directory to a same-origin static route.
Do not add a package dependency or a second browser driver for this fixture.

Use the visible controls in order: type Notes and select **Save notes**; select
**Read selection** while the picker is empty, then select **Briar Mask** and
select **Read selection** again; scroll the pane, then select
**Replace scroll pane**; in Form save failure and retry, select **Fail next save**, type a value, select **Save**, verify the alert and Retry control, then select **Retry**; finally select **Run all assertions**. The assertion
button does not create any synthetic selection, save, or scroll state. Read
the result element and `data-status` attributes through a read-only DOM
inspection. Capture the browser/version and fixture URL with the run evidence.

## Scope boundary

The fixture verifies real browser layout, bubbling events, radio-label
selection, and replacement-DOM scrolling while calling production helper
functions. Its sheet/document adapter and `prose-mirror` host are intentionally
minimal. The host supplies only the `name` property required by the production
persistence helper. The retry section uses a native input and a rejecting fake
Document adapter, so it verifies helper state and DOM retry wiring but does not
substitute for Foundry v13's ApplicationV2
lifecycle, DialogV2, document transaction behavior, or ProseMirror editor. Test those in
the running Foundry world using `tests/LIVE-FOUNDRY-REGRESSION-MATRIX.md`:
editor persistence is L05, picker behavior is L11, and sheet scroll behavior
is L04/L09. A green fixture is not a release sign-off.

## Identity visual comparison

`identity-visual-fixture.html` uses the exact class nesting from
`templates/parts/sheet-identity-row.html` inside Character and Mask wrapper
contracts. It contains editable, read-only, empty, selected, and long-value
rows. Select a stylesheet mode, choose each required width (700, 620, 480, and
410), capture the geometry, switch stylesheets, capture again at the same
width, then compare. The visible result lists computed geometry differences;
use it alongside CUA screenshots.

The current stylesheet is loaded relative to the repository. The comparison
baseline is supplied by the test server as `styles/baseline.css`; the
optional Foundry v13 stylesheet comes from the live test world at
`localhost:30000`. This is a CSS comparison fixture, not an ApplicationV2
rendering substitute.
