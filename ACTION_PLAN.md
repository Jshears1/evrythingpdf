# EvrythingPDF — Editor Power-Up Action Plan

_Owner: Jesse. Driver: Claude Code. Started 2026-07-07._

Goal: turn the PDF editor from "good enough" into the free tool people **bookmark and tell friends about**. Two tracks: (A) finish Phase 4, (B) build standout differentiating features. Ship in small committed slices so progress is never lost. Deploy after each milestone (Pages deploy is flaky — see handoff §6; verify via Cloudflare cache-bust, not github.io).

Architecture reminder: `editor.js` is the shared engine; `edit-text.html` + `add-text.html` are thin pages that both load it. **Toolbar markup must be edited in BOTH html files identically.** Annotations stored per page in PDF points, top-left origin; screen px = `pt * k()`.

---

## Legend
- [ ] not started  ·  [~] in progress  ·  [x] done + committed  ·  [L] live-verified on evrythingpdf.com

---

## Milestone 0 — Plan committed
- [ ] Write this plan, commit `docs: editor power-up action plan`.

## Milestone 1 — Fuzz overhaul (intensity 1–10 + brush size + pixelate mode)  ⭐ headline feature
Your ask: fuzz adjustable from "barely perceivable" to "fully fuzzed", scale 1–10, plus size.
- [ ] Add toolbar controls (both html): **Fuzz strength** slider `1–10` (`id=fuzzStrength`), **Fuzz size** already implied by drag box, add **blur vs pixelate** toggle (`id=fuzzMode`). Show only when Fuzz tool active (contextual toolbar row).
- [ ] `makeFuzzSnapshot()` takes `strength` (1–10): map to blur radius (e.g. `0.6 * strength * dpr`) OR pixelate block size (`2..24px`) when pixelate mode. Strength 10 in pixelate = redaction-grade (irreversible once flattened).
- [ ] Store `strength`/`mode` on the fuzz annotation so re-render + flatten reproduce it.
- [ ] Selected fuzz box: allow live strength re-adjust (re-snapshot from original page region — keep source rect so we can re-blur without stacking).
- [ ] Trust note: pixelate@8+ + Flatten = truly unrecoverable. Ties to "redact" keyword legitimately.

## Milestone 2 — Freehand erase / whiteout brush  ⭐ standout
Your ask: erase in freehand OR by boxes. Boxes exist; add freehand brush.
- [ ] New tool `erase` (toolbar btn, key `X`?). Paint mode: pointerdown+move paints whiteout using auto-matched page color (or manual). Implement as a path of stamped rects or a canvas-backed mask stored as a fuzz-like PNG annotation, OR as many small `wo` rects merged.
- [ ] **Brush size** slider (`id=brushSize`, contextual). 
- [ ] Eraser feel: color auto-matches background under the stroke start (sampleSurroundingColor).
- [ ] Keep existing box-whiteout intact.

## Milestone 3 — Full font bar (more fonts + prominent size/color)
Your ask: full bar, more fonts, change size & color.
- [ ] Self-host + embed 6+ new families (Google Fonts, OFL/Apache — legal to self-host): **Roboto, Open Sans, Montserrat, Merriweather (serif), Oswald (display), Source Code Pro (mono)**. Download 4 variants each into `/fonts/`, add `@font-face` (both html), extend `FONT_CSS`, `CUSTOM_FONTS`, dropdown, and `mapFont()` eyedropper matching.
- [ ] Replace bare number input with **size stepper + quick presets** and a **swatch row** of common colors next to the color picker (faster than opening OS picker). 
- [ ] Font size live-preview while typing (already applies on change — make it feel instant).

## Milestone 4 — Phase 4a: text-layer select/copy of original PDF text
- [ ] Render pdf.js text layer over `#pdfCanvas` in select mode so users can select + copy original text. Use `pdfjsLib.renderTextLayer({textContentSource, container, viewport})` (3.11 API).
- [ ] z-index/pointer-events: text layer must NOT intercept annotation drags. Enable only in `select` mode; disable during draw/text/erase/fuzz. Re-lay out on every `renderPage()`/zoom.
- [ ] "Copy all text on page" button as a bonus.

## Milestone 5 — Phase 4b: one-click edit-existing-text
- [ ] Click original text → reuse `sampleFontAt()` eyedropper + auto-whiteout the clicked item's box (coords like `scanPII`: `e, H-f-sz*0.85, it.width, sz*1.15`) + drop a matched, pre-filled text box with the item's string. Pure recombination of shipped pieces.

## Milestone 6 — Creative differentiators (the "bookmark + share" layer)
Curated from audit. Pick the highest-ROI; each is small on top of the engine.
- [ ] **Shapes & markup**: rectangle, line, arrow, checkmark, X, circle (form-filling + review). Vector, saved via pdf-lib draw ops.
- [ ] **Highlighter** (semi-transparent color pass) distinct from solid bg — real document markup.
- [ ] **Image / logo / signature stamp** inside the editor (place, resize, drag). (Signature has its own page; cross-wire.)
- [ ] **In-editor page ops**: rotate this page, delete page, insert blank page — so users don't bounce to other tools.
- [ ] **Privacy trust banner** in the editor: "No upload · No size limit · No watermark · No signup · Works offline." This is the share hook.
- [ ] **Installable PWA** (manifest + service worker) → "Add to home screen", works offline. Memorable, sticky.
- [ ] **Shareable result**: after save, a small "Made with EvrythingPDF — free, private" nudge + copy-link. (No file upload; just a referral nudge.)

## Milestone 7 — QA + SEO + deploy
- [ ] Preview-test each feature (clear IndexedDB + stub `confirm` first — handoff §6 gotcha).
- [ ] Update `edit-text.html` / `add-text.html` meta + hero copy to advertise new powers (fuzz slider, freehand erase, real redaction, N fonts). 
- [ ] Update index tool card copy.
- [ ] Smoke tests, commit, push, verify live via `curl ...?cb=$RANDOM`.

---

## Progress log (append as we go)
- 2026-07-07: plan created.
