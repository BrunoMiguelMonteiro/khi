# Visual parity harness

A test-only check that the UI does not change. It runs the **production build** (`build/`) in Playwright WebKit with the Tauri IPC mocked from fixtures. For each scenario it records:

- computed styles and boxes for every element, plus pseudo-elements;
- keyboard focus states (Alt+Tab stops, in order);
- hover and focus **states** of each interactive element type (`StateProbe`s): the element's subtree with full styles, plus a clipped screenshot;
- every infinite animation's target at 25%, 50% and 75% of its cycle (Web Animations `currentTime`), so keyframes are compared, not only the first frame;
- a full-page screenshot.

It then compares everything with `baseline/` and fails on any difference that `allowlist.json` does not cover. The comparison includes screenshots, which must match to 0 differing pixels.

## Commands

```sh
npm run test:visual          # build, then compare with baseline/ (includes the control test)
npm run test:visual:update   # build, then rewrite baseline/ (control test is skipped)
```

The report is written to `output/report.md`, grouped by capture, then element, then property (`before → after`). Diff images go to `output/diff/` and actual results to `output/actual/`. The IPC calls observed per capture go to `output/ipc/<capture>.json`. `output/` is gitignored.

Only update the baseline on a tree whose visuals you have verified. Run `test:visual` twice afterwards to check that the baseline is stable. Commit `baseline/` together with the change that justifies it.

## Matrix (63 captures + 10 controls)

Scenarios (`scenarios.ts`):

- `empty`: no Kobo connected.
- `grid`: Kobo connected, library grid.
- `list`: library list view.
- `detail`: book detail.
- `settings`: settings panel open.

  The `settings*` scenarios run in the Settings window: they open `/definicoes` directly, the mock reports window label `settings` (so no `app-ready`, no updater check, no menu), and the viewport is that window's fixed size, 700×540 (`settings_window_spec` in `src-tauri/src/window.rs`). The window is not resizable, so `settings--*--min` equals `settings--*`.
- `settings-appearance`: the appearance section of settings.
- `grid-selected` / `list-selected`: two books selected (indicators, checkboxes, the selection toolbar with «Clear selection» and the count).
- `settings-updates`: the Updates tab, with the automatic-check switch (hover, keyboard focus) and «Check now».
- `update`: the update dialog.
- `importing`: a sync in progress. `sync_kobo` is held pending (`__KHI_MOCK__.hold`), so the importing state with the pulsing Kobo icon stays on screen. Asserts `animation-name` is not `none`, or is `none` under reduced motion.
- `update-checking`: an update check in progress (held `plugin:updater|check`), with the pulsing progress bar.
- `settings-saving`: settings changed and Save pressed, with `save_settings` held, so the spinner shows.

Themes:

- `light`: app setting Light, OS light.
- `dark-app`: app setting Dark while the OS is **light**, which checks that `dark:` follows the `.dark` class.
- `system-dark`: app setting System, OS dark.

All scenarios × all themes, plus:

- `grid` and `settings` with `prefers-contrast: more` and with `prefers-reduced-motion: reduce`, each in light and dark-app;
- `importing`, `update-checking` and `settings-saving` with `prefers-reduced-motion: reduce`, in light and dark-app;
- `grid`, `list`, `detail` and `settings` at the **minimum window size** (suffix `--min`), in light and dark-app;
- `grid` in English (light).

Fixed for every capture:

- viewport 1000×669 at deviceScaleFactor 2 (the 1000×700 window less a 31px title bar); `--min` captures use tauri.conf.json's `minWidth` × `minHeight` less the same 31px (800×569); `settings*` captures use the Settings window's 700×540;
- locale pt-PT and app language pt;
- timezone Europe/Lisbon;
- clock frozen at 2026-11-15T10:00:00Z.

Requests to any origin other than the local server are aborted.

## How it works

- **`mock-ipc.ts`**: `installTauriMock` is serialised into `page.addInitScript`, so `window.__TAURI_INTERNALS__` and `__TAURI_EVENT_PLUGIN_INTERNALS__` exist before any app module runs.
  - It answers all commands in `src/lib/bindings.ts`, plus the plugin calls the app makes: event, app, window, menu, path, image, resources, updater and process. Each answer has its real return shape.
  - **Unknown commands are recorded and fail the test**, even when the app catches the rejection.
  - `window.__KHI_MOCK__.emit()` emits events. Scenarios wait until a listener for the event is registered before emitting.
  - `window.__KHI_MOCK__.hold(cmd)` makes the next call of `cmd` never resolve (it is listed in `held`, not counted as pending), to capture loading states. A held `sync_kobo` also emits two `sync-progress` events.
- **`fixtures.ts`**: deterministic data: 5 books, 1 reader, 1 device, and the settings for each theme.
- **`harness.ts`**: one capture:
  1. Waits for `app-ready` (in the Settings window, which never emits it: for `load_settings`).
  2. Drives the scenario.
  3. Waits for IPC to go quiet: menu built, nothing pending, more than 700 ms since the last call.
  4. Asserts the theme class on `<html>`.
  5. Waits for fonts, images (`load`/`error`, at most 5 s per image; the failure names the image URL), finite animations and scrolling, then records the DOM.
  6. Takes the screenshot with animations and the caret disabled. This happens only for the screenshot, after styles (including `transition-*`) have been recorded.
  7. Records focus stops by pressing **Alt+Tab**. WebKit on macOS skips buttons on plain Tab, as Safari does.
  8. Records each state: from no hover, no focus and all scroll positions at 0, it either hovers the target with the real mouse (asserting `:hover`) or presses Alt+Tab until the target has focus (asserting `:focus-visible`). Where focus or hover scrolled is not left to the browser: every scroll position goes back to 0, the target is revealed with `scrollIntoView({ block: 'nearest' })` and each position is written back in whole pixels (WebKit's focus scroll landed 140 or 141px for the same focus). Page focus stops get the same treatment. Then it records the target's root (`probe.root`, a `closest()` selector) with all descendants and takes a clip screenshot, `<capture>.state-<name>.png`. A target the keyboard cannot reach is left out, so the comparison reports the state missing (and `test:visual:update` refuses to write it).
  9. Records the animation phases: each infinite animation is sought to 25/50/75% of a cycle, its target's styles recorded (report element `animation <key> @<name> <n>%`), then put back.
- **`recorder.ts`**:
  - Records a curated list of computed longhands per element, keyed by a stable DOM path.
  - Converts every colour (including `oklch()`, `lab()`, `color()` and `color-mix()` results) to sRGB `rgba()`, so a different colour *syntax* is not reported as a diff but a different colour is.
  - Ignores `--tw-*` custom properties.
  - Drops box-shadow layers that paint nothing (a transparent colour, or all lengths 0).
  - Rounds boxes to 0.5 px.
- **`baseline-store.ts`**: `baseline/<capture>.json` holds the records and maps each screenshot name to the `pixelHash` of its pixels. That hash is a sha256 of the decoded RGBA and the size. Each distinct image is stored once, as `baseline/png/<pixelHash>.png`; `test:visual:update` deletes PNGs that no capture refers to.
- **`control.spec.ts`**: the judge of the judge. Every control goes through `capture` and `compareWithBaseline`, as the real captures do, and asserts that the comparator reports:
  - a 1-unit colour change and a 1px padding on `grid--light`: the colour, the padding, the box shift and the pixels;
  - `#export-path:focus { box-shadow: none }` on `settings--light`: the box-shadow in state `focus-text-input`, and its pixels;
  - the hovered highlight's copy button forced to `opacity: 0` on `detail--light`: the opacity in state `hover-highlight`, and its pixels;
  - `.kobo-icon { animation: none }` on `importing--light`: `animation-name`;
  - a deleted baseline PNG, a deleted baseline JSON and a state missing from the capture: `structure` failures that a permissive allowlist cannot approve;
  - a reviewed change approved by exact entries passes alone. A style entry with another `after` approves nothing. With an unrelated change on top, the screenshot entry no longer matches and the pixels are reported.

  - two selected books with the selected indicator forced to `opacity: 0` on `grid-selected--light`: opacity and pixels;
  - the automatic-update switch hidden on `settings-updates--light`: visibility, the hover state, the focus state reported missing, and pixels;
  - `@keyframes pulse` with its midpoint at 0.05 instead of 0.5 on `importing--light`: opacity at 25/50/75% only (the first frame is unchanged);
  - a `max-width: 899px` gap change: reported on `grid--light--min`, while `grid--light` shows no difference.

  If a control fails, the harness has gone blind.

## Allowlist

`allowlist.json` is an array of typed entries. It is validated strictly: an unknown `type`, a missing or empty field, or an extra field is an error. Every entry has `capture` (the capture id: exact, a `*` glob or a `/regex/`) and a `reason`. Each entry approves **one exact change**:

| `type` | Fields | Approves |
|---|---|---|
| `style` | `element` (pattern), `property` (exact), `before`, `after` (exact) | a property going from exactly `before` to exactly `after`. This includes pseudo-elements (`::before` `present → absent`) and `html` `class`. |
| `box` | `element` (pattern), `before`, `after` (exact, `x=… y=… w=… h=…`) | an element moving or resizing to exactly that box |
| `added` / `removed` | `element` (exact key, no pattern) | one element existing only after / only before |
| `screenshot` | `file` (exact, e.g. `grid--light.png`), `sha256` | that screenshot changing to exactly the pixels whose `pixelHash` is `sha256`. Any other pixel change, however small, is reported. |

```json
[
  {
    "type": "style",
    "capture": "/^settings--/",
    "element": "*input[id=\"export-path\"]*",
    "property": "box-shadow",
    "before": "rgba(59, 130, 246, 0.2) 0px 0px 0px 2px",
    "after": "rgba(59, 130, 246, 0.2) 0px 0px 0px 3px",
    "reason": "Tailwind v4 ring width; accepted in redesign Task 1, see PR #123."
  },
  {
    "type": "screenshot",
    "capture": "settings--light",
    "file": "settings--light.state-focus-text-input.png",
    "sha256": "<sha256 shown next to that screenshot in output/report.md>",
    "reason": "Same change; reviewed output/actual/settings--light.state-focus-text-input.png."
  }
]
```

The report shows each difference's kind, its exact `before`/`after` and, for pixels, the `sha256` of the new screenshot. Copy these values into an entry only after reviewing `output/actual/` and `output/diff/`.

**Never allowlistable** (`structure` differences): a missing baseline JSON or PNG; a screenshot captured on one side only; a state missing or with a different target; a different focus order. Regenerate the baseline instead, on a verified tree.

Keep entries as narrow as possible. The `reason` must say *why* the difference is intended and where that decision was made. "Noise" is not a reason: fix the nondeterminism instead.

## Limitations

- Playwright WebKit is not the WKWebView in the macOS app. They are the same engine family, but the versions, fonts and scrollbar rendering can differ. The harness compares like with like, so it detects *changes*; it is not a pixel-exact preview of the native app.
- Screenshots depend on the machine's installed fonts and the WebKit build. If either changes, regenerate the baseline on an untouched tree first.
- Known gap (accepted 2026-11-18): before recording a focus or hover state the harness resets scroll and reveals the target programmatically, then records only the target subtree. A regression that only appears in the focused state and only affects the scroll container (for example, the Settings panel stops scrolling while a field has focus) is not caught. Unconditional changes to container height, padding or offsets are caught.
- Computed widths are recorded unrounded, for example `80.765625px`. This is deliberately strict.
