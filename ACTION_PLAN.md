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
- 2026-07-07: **M1–M6 built + preview-verified in one pass.** Shipped:
  - M1 Fuzz overhaul: strength slider 1–10 + Blur/Pixelate toggle, live re-blur of selected box, strength/mode stored per annotation. Pixelate@high + Flatten = redaction-grade.
  - M2 Freehand erase brush (`paint` annotation type, raster-backed, auto color-match, brush-size slider).
  - M3 Full font bar: +6 self-hosted families (PT Sans, Fira Sans, PT Serif, IBM Plex Serif, Crimson Text, IBM Plex Mono) → 12 total, optgrouped dropdown, quick color swatches; eyedropper maps the new families.
  - M4 Text-layer select/copy (pdf.js text layer, `Copy` tool + "Copy page text").
  - M5 One-click edit-existing-text (`Edit` tool: whiteout + matched prefilled box).
  - M6 Shapes (rect/ellipse/line/arrow/check/cross — vector on save, canvas on flatten), privacy trust bar, installable PWA (manifest + service worker + icon), share button.
  - Contextual toolbar (each tool's options show only when active/selected).
  - Verified: all 5 new annotation types render; vector save reopens clean; flatten save = **0 text items (true redaction)**; edit-text adds wo+text; copy extracts page text; 12 fonts load; no console errors.
- **DEFERRED (not built this pass):** M6 in-editor page rotate/delete/insert — reindexing annotations across page mutations is risky and `rotate.html`/`reorder.html`/`split.html` already cover it. Also skipped: image/logo stamp in-editor (`add-image.html` exists), dedicated highlighter (text-bg highlight + shape-fill cover it).
- M7 QA/SEO: hero copy + meta advertise new powers; index tool cards updated. Deployed + verified live.
- 2026-07-07: **Metadata tool** (`metadata.html`) — view/edit/strip Title, Author, Subject, Keywords, Creator, Producer, dates + page count/size/encrypted. Live.
- 2026-07-07: **Metadata Tier 2** — pdf-lib re-stamps Producer/ModDate on save via an internal path (not interceptable in the minified build). Fixed with a spec-compliant PDF incremental-update append (`applyInfoIncremental`): new Info object + xref delta + trailer `/Info`→it with `/Prev`. Every field now written exactly (incl. Producer/ModDate); strip truly omits all. Verified with pdf.js (spec parser real viewers use). Live.
- 2026-07-07: **4 new standalone tools** (per multi-domain plan: separate pages on .com; hybrid planned for .org; single-page for .online):
  - `crop.html` — visual drag-box margin trim, setCropBox/MediaBox per page (proportional; verified on mixed page sizes).
  - `organize.html` — thumbnail select → delete or extract pages (pdf-lib copyPages).
  - `redact.html` — keyword find (case/whole-word) → black-box marks → flatten raster = true removal (0 text items). Render serialized to avoid canvas-collision.
  - `fill-form.html` — AcroForm text/checkbox/dropdown/radio fill + optional flatten. Radio groups verified.
  - All: homepage cards, PWA precache, per-page SEO meta + JSON-LD. Live.
- 2026-07-07: **Loose-end hardening** — verified radio groups, whole-word/multipage redact, mixed-size crop; fixed redact render-collision (serialized render chain); this plan doc updated.

## Still open (opt-in, not started)
- Future tools: extract images, Bates numbering, bookmarks/TOC editor, N-up/booklet.
- `.org` hybrid unified workspace; `.online` single-page build.
- In-editor page rotate/delete/insert (deferred; standalone tools cover it).
