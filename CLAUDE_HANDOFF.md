# EvrythingPDF — Handoff to Claude Code

_Written 2026-07-06 by the Cowork session. Repo: `~/evrythingpdf` (github.com/Jshears1/evrythingpdf), branch `main`, GitHub Pages behind Cloudflare, CNAME evrythingpdf.com._

## 0. DO THIS FIRST — push + purge (you have the terminal + gh auth; the Cowork session did not)

There are **3 unpushed commits** on `main`, already made locally in this clone:

```
d30fa45  Phase 2: real fonts + font-match eyedropper
6019d71  Phase 0+1: shared editor.js engine; retire legacy editor; redo/clipboard/highlight/nudge/autosave
b8cd7af  Worker fix site-wide: same-origin blob worker across all pdf.js pages
```

### Step 1 — push
```bash
cd ~/evrythingpdf
git log --oneline origin/main..HEAD    # confirm the 3 commits above
git push origin main
```

### Step 2 — wait for the Pages build
```bash
gh api repos/Jshears1/evrythingpdf/pages/builds/latest --jq .status   # want "built"
```
Re-run until it says `built` (usually 1–3 min). If it stays `building` >30 min, push an empty commit: `git commit --allow-empty -m rebuild && git push`.

### Step 3 — purge Cloudflare (HTML is being served stale — this is the actual reason the site looked un-updated)
Needs a Cloudflare API token with cache-purge on the zone. If `CLOUDFLARE_API_TOKEN` and the zone id are available (ask Jesse if not):
```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```
No token? Tell Jesse to purge in the Cloudflare dashboard: **Caching → Configuration → Purge Everything** (or purge by URL: `/edit-text.html`, `/add-text.html`, `/editor.js`). Recommend a follow-up cache rule to bypass/short-TTL HTML so future deploys don't stick.

### Step 4 — verify live
```bash
curl -s https://evrythingpdf.com/edit-text.html | grep -c editor.js    # expect 1
curl -s https://evrythingpdf.com/editor.js       | grep -c toolMatch    # expect >=1  (proves Phase 2 is live)
```

---

## 1. Architecture (read before editing)

**Shared engine.** `editor.js` (~700 lines) is the whole editor. Both `edit-text.html` and `add-text.html` are thin pages that load it (`<script src="editor.js">`) — same engine, two SEO URLs. **Edit the engine once; both pages get it.** The two HTML files must stay in sync for the toolbar markup the engine references (element ids).

**Coordinate model.** Annotations are stored per page in PDF **points, top-left origin**: `annots = { [pageNum]: [ann, ...] }`. Screen px = `pt * k()` where `k() = baseScale * zoom`. On save (pdf-lib, bottom-left origin) y is flipped: `y = pageHeight - annY - annH`.

**Annotation types:** `wo` (whiteout rect `{x,y,w,h,fill}`), `fuzz` (blurred PNG snapshot `{x,y,w,h,img}`), `text` (`{x,y,text,font,size,bold,italic,color,bg}`).

**Rendering:** pdf.js renders the page to `#pdfCanvas`; annotations are DOM elements in `#overlay` positioned over it. `renderAnnots()` rebuilds the overlay; `renderPage()` re-rasterizes.

**Undo/redo:** JSON snapshots of `annots` in `undoStack`/`redoStack` (cap 80). Fuzz `Image` objects live in `imgCache` (Map by id) because JSON can't hold them.

**Autosave / crash recovery:** debounced writes to IndexedDB (`evrythingpdf-editor` → store `session` → key `last`) storing `{fileName, bytes, annots, nextId, pageNum}`. On load, `checkRestore()` offers to restore unsaved edits. Cleared on "start over".

**Fonts:** standard-14 (Helvetica/Times/Courier) via pdf-lib `StandardFonts`; custom families (Carlito/Lato/Poppins) self-hosted in `/fonts/`, previewed via `@font-face`, embedded on save through **fontkit** with `{ subset: true }` (keeps output small). `CUSTOM_FONTS` maps family → variant file urls; `loadFontBytes()` fetches+caches.

**Font-match eyedropper:** `Match` tool / key **E** → `sampleFontAt()` reads the nearest pdf.js text item's font (via `curPageObj.commonObjs.get(fontName).name`, fallback `textContent.styles`) + size (transform matrix), samples ink color from the darkest nearby canvas pixel, sets the toolbar, switches to Text mode. `mapFont()` maps real font names to our families.

**pdf.js worker fix (site-wide):** browsers block cross-origin Workers → fetch the worker script and run it as a same-origin `blob:`. Pattern is in `editor.js` (top) and inline in every other pdf.js page (viewer/sign/reorder/draw/add-image/pdf-to-jpg). Any NEW page that uses pdf.js must copy it.

## 2. Conventions & gotchas
- Every page keeps the GA (`G-WY6LCLDYFN`) + AdSense (`ca-pub-7338860226113687`) tags. Don't drop them.
- CDN libs from unpkg: pdf-lib 1.17.1, pdf.js 3.11.174, @pdf-lib/fontkit 1.1.1. **No SRI hashes / no fallback yet** — known tech debt (unpkg outage or compromise = broken/hostile). Consider self-hosting + `integrity` in a later pass.
- SEO: each tool is its own `.html` with keyword-targeted title/meta/canonical. `edit-text` and `add-text` stay separate URLs.
- **Whiteout is NOT redaction** — covered text remains extractable from the file. `edit-text.html` meta still targets the keyword "redact pdf online"; **remove that keyword until real redaction ships** (Phase 4) or it's a trust/liability problem.
- `pdf-editor-tool.html` was retired to a noindex redirect stub → `/edit-text.html` (was a legacy duplicate).
- `git` identity in a fresh clone/CI: `user.name=Jshears1`, `user.email=jessenshears@gmail.com`.

## 3. What shipped (Phases 0–2, all in the 3 unpushed commits)
- **P0:** extracted the duplicated inline engine into `editor.js`; worker fix confirmed across all 9 pdf.js pages; killed the legacy editor page.
- **P1:** redo (Ctrl+Shift+Z / Ctrl+Y), copy/cut/paste/duplicate elements (Ctrl+C/X/V/D), text highlight/background color, arrow-key nudge (Shift = 10pt), IndexedDB autosave + crash recovery, fixed the "Type here" placeholder-left-behind bug.
- **P2:** real fonts (Carlito=Calibri match, Lato, Poppins) subset-embedded via fontkit; font-match eyedropper.

### Smoke tests to run after deploy
1. Load multi-page PDF → add text → Ctrl+C/Ctrl+V duplicates offset.
2. Toggle highlight + color, Save → highlight bakes behind text in the PDF.
3. Make edits → refresh → offered a restore.
4. Pick Poppins, Save → renders in Poppins; output file size stays small (subset working).
5. Match tool → click a Calibri/Arial line → toolbar matches font/size/color.

## 4. Roadmap — remaining phases (approved order)

### Phase 3 — OCR
- tesseract.js, **lazy-load the wasm only on demand** (heavy). Add a "Make searchable / Extract text" action for scanned/image PDFs.
- MVP: run OCR per page on the rendered canvas → return copyable text + optional `.txt` download.
- Stretch: build a searchable PDF. NOTE: pdf-lib has no invisible-text render mode (Tr 3); a true invisible OCR layer isn't directly supported. Options: overlay near-transparent text, or accept "extract text" as the deliverable. Flag the tradeoff to Jesse before building.

### Phase 4 — original-text select/copy + QA & positioning
- pdf.js **text layer** over the canvas so users can select/copy the original PDF text.
- One-click "edit existing text": eyedropper + auto-whiteout the original + matched text box (combines P2 + whiteout).
- **True redaction / flatten** (differentiator + fixes the "redact" liability): rasterize the page at ~2× and rebuild it as a full-page image so underlying text is destroyed. Offer as a save-time toggle.
- **PII auto-redact** (cheap standout): regex the text/OCR layer for SSNs, emails, card numbers → suggest redactions.
- QA pass; drop the misleading "redact" keyword until real redaction is live.

### Nice-to-have standouts already discussed
Privacy branding ("no upload, no size cap, no watermark, no limits"), installable PWA/offline, cross-tool handoff (IndexedDB → "continue in Merge/Sign"), batch mode.

## 5. Task ledger
- Phase 0 ✅ code (deploy = your Step 1–4 above)
- Phase 1 ✅
- Phase 2 ✅
- Phase 3 ✅ shipped + live (OCR)
- Phase 4 🔶 in progress — true redaction/flatten done + live; remaining below

---

## 6. Session update — 2026-07-06 (Claude Code)

### Phase 3 — OCR ✅ live

- New `ocr.html`: pdf.js renders each page to canvas; **tesseract.js v5 lazy-loaded on demand** (`https://unpkg.com/tesseract.js@5/dist/tesseract.min.js` injected on first "Extract Text" click — engine/wasm only download then). Per-page recognize, editable `<textarea>` output, Copy + Download `.txt`. English (`eng`) only. Reuses the same-origin blob worker fix. Tool card added to the index Convert grid.
- MVP = extract text (no searchable-PDF layer), per the roadmap tradeoff.

### Phase 4 — true redaction / flatten ✅ live

- **`Flatten & redact` checkbox** in `#actions` of BOTH `edit-text.html` and `add-text.html` (`id="flattenToggle"`).
- Engine (`editor.js`): `saveFlattened()` + `renderFlatPage(pn, scale)` + `loadImg()`. When the toggle is on, `save()` branches: rasterizes every page at 2× with annotations baked onto the canvas (whiteout rects, fuzz images, text drawn with `FONT_CSS`, baseline `top + 0.92*size` to match the vector path), rebuilds a fresh PDF as full-page JPEGs sized to the original pt dims. Underlying text/vectors destroyed → real redaction. Output named `-redacted.pdf`, not text-selectable.
- Verified in-browser: a PDF with extractable "SECRET" → flattened output has **0 extractable text items**, page count + pt dims preserved.
- The misleading `redact` SEO keyword is now legitimate (real redaction shipped) — kept as-is.

### Phase 4 — REMAINING (approved order, not yet built)

1. **pdf.js text-layer select/copy** of the original PDF text (overlay text layer on the canvas).
2. **One-click "edit existing text"**: reuse `sampleFontAt()` eyedropper (P2) + auto-whiteout the original glyph box + drop a matched text box. Combines existing pieces.
3. **PII auto-redact**: regex the pdf.js text layer / OCR output for SSNs, emails, card numbers → auto-suggest whiteout+flatten boxes. Cheapest standout; do first.

### ⚠️ Non-obvious gotchas (hard-won — not derivable from the repo)

- **GitHub Pages deploy is flaky.** The Jekyll *build* succeeds and uploads a valid artifact, but the *deploy* step intermittently fails with `"Deployment failed, try again later"` (`pages/builds` shows `errored` / "Page build failed"). It is a GitHub-side blip, **not your code**. Fix: `gh run rerun <id> --failed`, or push an empty commit (`git commit --allow-empty`). Cost this session: 3 throwaway rebuild commits.
- **Verify deploys via Cloudflare cache-bust, NOT github.io.** `curl -s "https://evrythingpdf.com/editor.js?cb=$RANDOM" | grep -c saveFlattened` bypasses the edge cache and hits origin. The `jshears1.github.io/evrythingpdf/...` path gave misleading `0`s. On the normal CF URL, a fresh deploy shows `cf-cache-status: HIT` with `age: 0` + today's `last-modified` — that means fresh, not stale.
- **HTML is served `DYNAMIC` (uncached) now** — no stale-HTML lag for `.html`. Only static assets carry the 4h `max-age`. A short-TTL/bypass cache rule for JS is still worth adding so `editor.js` deploys aren't cache-lagged.
- **Preview/eval testing:** the editor's crash-recovery `confirm()` (from `checkRestore`) **blocks the headless renderer** — a native modal freezes all `preview_eval` (even `1+1` times out). Before driving the editor in preview: clear its store with `indexedDB.deleteDatabase('evrythingpdf-editor')` from a page that doesn't run `checkRestore` (e.g. `/`), then navigate in; and stub `window.confirm=()=>false` at the top of the test. Also: a stuck `page.render()` (never-resolving) jams the single pdf.js worker so later renders queue forever — reload to clear. Long OCR/flatten work exceeds the 30s eval cap → use fire-and-poll (store result on `window.__x`, poll it) instead of awaiting.
- **`.claude/launch.json` lives at `~/.claude/`** (home), not the repo, for the preview server. `python3 -m http.server 8099 --directory ~/evrythingpdf`. It's untracked.
