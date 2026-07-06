'use strict';
/* Load the pdf.js worker as a same-origin blob: browsers block cross-origin
   Workers (SecurityError), and pdf.js's fake-worker fallback is slow/fragile. */
const WORKER_URL = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_URL;
const workerReady = fetch(WORKER_URL)
  .then(r => r.text())
  .then(t => { pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([t], { type: 'text/javascript' })); })
  .catch(() => {});
const { PDFDocument, StandardFonts, rgb } = PDFLib;

/* ---------- state ---------- */
let pdfjsDoc = null;          // pdf.js document (rendering)
let originalBytes = null;     // original file bytes (pdf-lib source)
let fileName = 'document.pdf';
let pageNum = 1, pageCount = 1;
let baseScale = 1.5, zoom = 1; // effective scale k = baseScale * zoom (px per pt)
let pageDims = {};            // pageNum -> {w,h} in pt
let annots = {};              // pageNum -> [annotation]
let selected = null;          // selected annotation object
let mode = 'select';
let undoStack = [];
let redoStack = [];
let clipboard = null;
let nudgeSnapped = false;
let nextId = 1;
let rendering = false, renderQueued = false;
let pageText = {};      // per-page pdf.js text content (font eyedropper)
let curPageObj = null;  // pdf.js page object for the current page

const $ = id => document.getElementById(id);
const canvas = $('pdfCanvas'), ctx = canvas.getContext('2d'), overlay = $('overlay');
const k = () => baseScale * zoom;

const FONT_CSS = {
  Helvetica: 'Helvetica, Arial, sans-serif',
  TimesRoman: '"Times New Roman", Times, serif',
  Courier: '"Courier New", Courier, monospace',
  Carlito: 'Carlito, Calibri, sans-serif',
  Lato: 'Lato, "Segoe UI", sans-serif',
  Poppins: 'Poppins, sans-serif'
};
// Self-hosted real fonts embedded on save (subset). Keys mirror the dropdown.
const CUSTOM_FONTS = {
  Carlito: { files: { r: 'fonts/Carlito-Regular.ttf', b: 'fonts/Carlito-Bold.ttf', i: 'fonts/Carlito-Italic.ttf', bi: 'fonts/Carlito-BoldItalic.ttf' } },
  Lato:    { files: { r: 'fonts/Lato-Regular.ttf', b: 'fonts/Lato-Bold.ttf', i: 'fonts/Lato-Italic.ttf', bi: 'fonts/Lato-BoldItalic.ttf' } },
  Poppins: { files: { r: 'fonts/Poppins-Regular.ttf', b: 'fonts/Poppins-Bold.ttf', i: 'fonts/Poppins-Italic.ttf', bi: 'fonts/Poppins-BoldItalic.ttf' } }
};
const STD_FONTS = {
  'Helvetica':        { n: 'Helvetica',            b: 'HelveticaBold',        i: 'HelveticaOblique',    bi: 'HelveticaBoldOblique' },
  'TimesRoman':       { n: 'TimesRoman',           b: 'TimesRomanBold',       i: 'TimesRomanItalic',    bi: 'TimesRomanBoldItalic' },
  'Courier':          { n: 'Courier',              b: 'CourierBold',          i: 'CourierOblique',      bi: 'CourierBoldOblique' }
};

/* ---------- helpers ---------- */
function toast(msg, type) {
  const t = $('toast');
  t.textContent = msg; t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(t._h); t._h = setTimeout(() => t.className = 'toast', 3200);
}
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
function pageAnnots() { return annots[pageNum] || (annots[pageNum] = []); }
function snapshot() {
  undoStack.push(JSON.stringify(annots));
  if (undoStack.length > 80) undoStack.shift();
  redoStack.length = 0;
  scheduleAutosave();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(annots));
  annots = JSON.parse(undoStack.pop());
  selected = null;
  renderAnnots();
  scheduleAutosave();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(annots));
  annots = JSON.parse(redoStack.pop());
  selected = null;
  renderAnnots();
  scheduleAutosave();
}

/* ---------- file loading ---------- */
const dropZone = $('dropZone'), fileInput = $('fileInput');
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e => { if (e.target.files[0]) loadFile(e.target.files[0]); });

async function loadFile(file) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return toast('Please choose a PDF file.', 'error');
  }
  try {
    fileName = file.name;
    await workerReady;
    originalBytes = new Uint8Array(await file.arrayBuffer());
    pdfjsDoc = await pdfjsLib.getDocument({ data: originalBytes.slice() }).promise;
    pageCount = pdfjsDoc.numPages;
    pageNum = 1; annots = {}; undoStack = []; redoStack = []; selected = null;
    // fit-to-width base scale
    const p1 = await pdfjsDoc.getPage(1);
    const vp = p1.getViewport({ scale: 1 });
    const avail = Math.min(document.querySelector('.editor-shell').clientWidth - 50, 1000);
    baseScale = Math.min(1.6, Math.max(0.8, avail / vp.width));
    dropZone.style.display = 'none';
    ['toolbar','stage'].forEach(id => $(id).style.display = 'flex');
    $('stage').style.display = 'block';
    $('pageNav').style.display = pageCount > 1 ? 'flex' : 'none';
    $('actions').style.display = 'flex';
    $('hint').style.display = 'block';
    await renderPage();
    toast('PDF loaded — ' + pageCount + ' page' + (pageCount > 1 ? 's' : ''), 'success');
    scheduleAutosave();
  } catch (err) {
    console.error(err);
    toast('Could not open this PDF. It may be corrupted or password-protected.', 'error');
  }
}

$('newFileBtn').addEventListener('click', () => {
  if (Object.values(annots).some(a => a.length) && !confirm('Discard your edits and start over?')) return;
  pdfjsDoc = null; originalBytes = null; annots = {}; undoStack = []; redoStack = [];
  ['toolbar','stage','pageNav','actions','hint'].forEach(id => $(id).style.display = 'none');
  dropZone.style.display = 'block';
  fileInput.value = '';
  idbClear();
});

/* ---------- rendering ---------- */
async function renderPage() {
  if (!pdfjsDoc) return;
  if (rendering) { renderQueued = true; return; }
  rendering = true;
  try {
    const page = await pdfjsDoc.getPage(pageNum);
    curPageObj = page;
    const vp1 = page.getViewport({ scale: 1 });
    pageDims[pageNum] = { w: vp1.width, h: vp1.height };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vp = page.getViewport({ scale: k() * dpr });
    canvas.width = vp.width; canvas.height = vp.height;
    canvas.style.width = (vp.width / dpr) + 'px';
    canvas.style.height = (vp.height / dpr) + 'px';
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    $('pageInfo').textContent = 'Page ' + pageNum + ' / ' + pageCount;
    $('prevPage').disabled = pageNum <= 1;
    $('nextPage').disabled = pageNum >= pageCount;
    renderAnnots();
  } finally {
    rendering = false;
    if (renderQueued) { renderQueued = false; renderPage(); }
  }
}

$('prevPage').addEventListener('click', () => { if (pageNum > 1) { pageNum--; selected = null; renderPage(); } });
$('nextPage').addEventListener('click', () => { if (pageNum < pageCount) { pageNum++; selected = null; renderPage(); } });
$('zoomSel').addEventListener('change', e => { zoom = parseFloat(e.target.value); renderPage(); });
$('undoBtn').addEventListener('click', undo);
$('redoBtn').addEventListener('click', redo);

/* ---------- tool modes ---------- */
function setMode(m) {
  mode = m;
  overlay.className = 'mode-' + m;
  $('toolSelect').classList.toggle('active', m === 'select');
  $('toolText').classList.toggle('active', m === 'text');
  $('toolWhiteout').classList.toggle('active', m === 'whiteout');
  $('toolFuzz').classList.toggle('active', m === 'fuzz');
  $('toolMatch').classList.toggle('active', m === 'match');
  if (m !== 'select') { selected = null; renderAnnots(); }
}
$('toolSelect').addEventListener('click', () => setMode('select'));
$('toolText').addEventListener('click', () => setMode('text'));
$('toolWhiteout').addEventListener('click', () => setMode('whiteout'));
$('toolFuzz').addEventListener('click', () => setMode('fuzz'));
$('toolMatch').addEventListener('click', () => setMode('match'));

let woAutoMatch = true;
$('woAuto').addEventListener('click', () => {
  woAutoMatch = !woAutoMatch;
  $('woAuto').classList.toggle('active', woAutoMatch);
});
$('woColor').addEventListener('input', () => {
  woAutoMatch = false;
  $('woAuto').classList.remove('active');
  if (selected && selected.type === 'wo') { snapshot(); selected.fill = $('woColor').value; renderAnnots(); }
});

/* toolbar -> selected text annotation */
function applyStyleToSelected() {
  if (!selected || selected.type !== 'text') return;
  snapshot();
  selected.font = $('fontFamily').value;
  selected.size = parseFloat($('fontSize').value) || 16;
  selected.bold = $('boldBtn').classList.contains('active');
  selected.italic = $('italicBtn').classList.contains('active');
  selected.color = $('textColor').value;
  selected.bg = $('bgToggle').classList.contains('active') ? $('textBg').value : null;
  renderAnnots();
}
$('fontFamily').addEventListener('change', applyStyleToSelected);
$('textBg').addEventListener('input', applyStyleToSelected);
$('bgToggle').addEventListener('click', () => { $('bgToggle').classList.toggle('active'); applyStyleToSelected(); });
$('fontSize').addEventListener('change', applyStyleToSelected);
$('textColor').addEventListener('input', applyStyleToSelected);
$('boldBtn').addEventListener('click', () => { $('boldBtn').classList.toggle('active'); applyStyleToSelected(); });
$('italicBtn').addEventListener('click', () => { $('italicBtn').classList.toggle('active'); applyStyleToSelected(); });

function syncToolbarFrom(a) {
  if (a.type !== 'text') return;
  $('fontFamily').value = a.font;
  $('fontSize').value = a.size;
  $('textColor').value = a.color;
  $('boldBtn').classList.toggle('active', !!a.bold);
  $('italicBtn').classList.toggle('active', !!a.italic);
  $('bgToggle').classList.toggle('active', !!a.bg);
  if (a.bg) $('textBg').value = a.bg;
}

/* ---------- color sampling (whiteout auto-match) ---------- */
function sampleSurroundingColor(px, py, pw, ph) {
  // px,py,pw,ph in CSS pixels relative to canvas. Sample a ring just outside
  // the rectangle and return the dominant (modal) color — this skips over
  // text pixels inside the box and matches the true page background.
  const dpr = canvas.width / canvas.clientWidth;
  const pad = Math.max(4, Math.round(6 * dpr));
  const x0 = Math.max(0, Math.round(px * dpr) - pad);
  const y0 = Math.max(0, Math.round(py * dpr) - pad);
  const x1 = Math.min(canvas.width, Math.round((px + pw) * dpr) + pad);
  const y1 = Math.min(canvas.height, Math.round((py + ph) * dpr) + pad);
  const ix0 = Math.round(px * dpr), iy0 = Math.round(py * dpr);
  const ix1 = Math.round((px + pw) * dpr), iy1 = Math.round((py + ph) * dpr);
  let data;
  try { data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data; }
  catch (e) { return '#ffffff'; }
  const buckets = new Map();
  const W = x1 - x0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      // ring only: skip pixels inside the selection
      if (x >= ix0 && x < ix1 && y >= iy0 && y < iy1) continue;
      const o = ((y - y0) * W + (x - x0)) * 4;
      const r = data[o], g = data[o + 1], b = data[o + 2];
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4); // 16-level quantization
      let e = buckets.get(key);
      if (!e) buckets.set(key, e = { n: 0, r: 0, g: 0, b: 0 });
      e.n++; e.r += r; e.g += g; e.b += b;
    }
  }
  let best = null;
  for (const e of buckets.values()) if (!best || e.n > best.n) best = e;
  if (!best) return '#ffffff';
  return rgbToHex(Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n));
}

/* ---------- font-match eyedropper ---------- */
async function ensurePageText() {
  if (pageText[pageNum] || !curPageObj) return;
  try { pageText[pageNum] = await curPageObj.getTextContent(); }
  catch (_) { pageText[pageNum] = { items: [], styles: {} }; }
}
function mapFont(fontName, tc) {
  let name = '';
  try { const o = curPageObj && curPageObj.commonObjs.get(fontName); if (o && o.name) name = o.name; } catch (_) {}
  if (!name && tc && tc.styles && tc.styles[fontName]) name = tc.styles[fontName].fontFamily || '';
  name = (name || '').toLowerCase();
  const bold = /bold|black|heavy|semibold|-bd|extrab/.test(name);
  const italic = /italic|oblique/.test(name);
  let fam = 'Helvetica';
  if (/calibri|carlito/.test(name)) fam = 'Carlito';
  else if (/poppins/.test(name)) fam = 'Poppins';
  else if (/lato/.test(name)) fam = 'Lato';
  else if (/courier|mono|consol/.test(name)) fam = 'Courier';
  else if (/times|georgia|garamond|roman|minion|serif|antiqua|cambria/.test(name)) fam = 'TimesRoman';
  return { fam, bold, italic };
}
function sampleTextColor(px, py) {
  const dpr = canvas.width / canvas.clientWidth;
  const R = Math.max(6, Math.round(8 * dpr));
  const x0 = Math.max(0, Math.round(px * dpr) - R), y0 = Math.max(0, Math.round(py * dpr) - R);
  const w = Math.min(canvas.width - x0, R * 2), h = Math.min(canvas.height - y0, R * 2);
  let data; try { data = ctx.getImageData(x0, y0, w, h).data; } catch (_) { return $('textColor').value; }
  let best = null, bestL = 1e9;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const L = 0.299 * r + 0.587 * g + 0.114 * b;
    if (L < bestL) { bestL = L; best = [r, g, b]; }
  }
  return best ? rgbToHex(best[0], best[1], best[2]) : $('textColor').value;
}
async function sampleFontAt(p) {
  await ensurePageText();
  const s = k();
  const pdfX = p.x / s;
  const Hpt = pageDims[pageNum] ? pageDims[pageNum].h : 0;
  const pdfY = Hpt - p.y / s;
  const tc = pageText[pageNum];
  let hit = null;
  if (tc) for (const it of tc.items) {
    if (!it.str || !it.str.trim()) continue;
    const tr = it.transform; const ix = tr[4], iy = tr[5];
    const sz = Math.hypot(tr[2], tr[3]) || Math.abs(tr[3]) || it.height || 10;
    const w = it.width || sz * it.str.length * 0.5;
    if (pdfX >= ix - 1 && pdfX <= ix + w + 1 && pdfY >= iy - sz * 0.35 && pdfY <= iy + sz * 0.95) { hit = { it, sz }; break; }
  }
  const color = sampleTextColor(p.x, p.y);
  if (hit) {
    const m = mapFont(hit.it.fontName, tc);
    const size = Math.max(6, Math.min(144, Math.round(hit.sz)));
    $('fontFamily').value = m.fam;
    $('fontSize').value = size;
    $('textColor').value = color;
    $('boldBtn').classList.toggle('active', m.bold);
    $('italicBtn').classList.toggle('active', m.italic);
    setMode('text');
    toast('Matched ' + m.fam.replace('TimesRoman', 'Times') + (m.bold ? ' Bold' : '') + (m.italic ? ' Italic' : '') + ' ~' + size + 'pt — click to place text', 'success');
  } else {
    $('textColor').value = color;
    toast('No selectable text there — sampled the color (' + color + ')');
  }
}

/* ---------- fuzz (light blur, one layer per pass) ---------- */
const imgCache = new Map(); // annot id -> loaded Image (survives undo snapshots)
const fontBytesCache = {};
async function loadFontBytes(url) {
  if (!fontBytesCache[url]) fontBytesCache[url] = await fetch(url).then(r => { if (!r.ok) throw new Error('font ' + r.status); return r.arrayBuffer(); });
  return fontBytesCache[url];
}

function makeFuzzSnapshot(px, py, pw, ph) {
  // Composite the rendered page region plus any overlapping whiteout/fuzz
  // annotations, then apply one light blur pass. Returns a PNG data URL.
  const dpr = canvas.width / canvas.clientWidth;
  const sx = px * dpr, sy = py * dpr, sw = Math.max(1, pw * dpr), sh = Math.max(1, ph * dpr);
  const tmp = document.createElement('canvas');
  tmp.width = Math.round(sw); tmp.height = Math.round(sh);
  const tc = tmp.getContext('2d');
  tc.drawImage(canvas, sx, sy, sw, sh, 0, 0, tmp.width, tmp.height);
  const s = k();
  for (const a of pageAnnots()) {
    const ax = (a.x * s - px) * dpr, ay = (a.y * s - py) * dpr;
    if (a.type === 'wo') {
      tc.fillStyle = a.fill;
      tc.fillRect(ax, ay, a.w * s * dpr, a.h * s * dpr);
    } else if (a.type === 'fuzz') {
      const im = imgCache.get(a.id);
      if (im && im.complete) tc.drawImage(im, ax, ay, a.w * s * dpr, a.h * s * dpr);
    }
  }
  // light blur: half-res round trip + ~1px gaussian
  const t2 = document.createElement('canvas');
  t2.width = Math.max(1, Math.round(tmp.width / 2));
  t2.height = Math.max(1, Math.round(tmp.height / 2));
  t2.getContext('2d').drawImage(tmp, 0, 0, t2.width, t2.height);
  tc.clearRect(0, 0, tmp.width, tmp.height);
  try { tc.filter = 'blur(' + Math.max(1, dpr) + 'px)'; } catch (_) {}
  tc.drawImage(t2, 0, 0, t2.width, t2.height, 0, 0, tmp.width, tmp.height);
  try { tc.filter = 'none'; } catch (_) {}
  return tmp.toDataURL('image/png');
}

function addFuzz(px, py, pw, ph) {
  const url = makeFuzzSnapshot(px, py, pw, ph);
  snapshot();
  const s = k();
  const a = { id: nextId++, type: 'fuzz', x: px / s, y: py / s, w: pw / s, h: ph / s, img: url };
  const im = new Image(); im.src = url;
  imgCache.set(a.id, im);
  pageAnnots().push(a);
  selected = a;
  renderAnnots();
}

/* ---------- annotation DOM ---------- */
function renderAnnots() {
  overlay.innerHTML = '';
  const s = k();
  for (const a of pageAnnots()) {
    let el;
    if (a.type === 'wo') {
      el = document.createElement('div');
      el.className = 'ann ann-wo';
      el.style.left = a.x * s + 'px';
      el.style.top = a.y * s + 'px';
      el.style.width = a.w * s + 'px';
      el.style.height = a.h * s + 'px';
      el.style.background = a.fill;
    } else if (a.type === 'fuzz') {
      el = document.createElement('img');
      el.className = 'ann ann-fuzz';
      el.draggable = false;
      el.src = a.img;
      el.style.left = a.x * s + 'px';
      el.style.top = a.y * s + 'px';
      el.style.width = a.w * s + 'px';
      el.style.height = a.h * s + 'px';
    } else {
      el = document.createElement('div');
      el.className = 'ann ann-text';
      el.style.left = a.x * s + 'px';
      el.style.top = a.y * s + 'px';
      el.style.fontFamily = FONT_CSS[a.font];
      el.style.fontSize = a.size * s + 'px';
      el.style.fontWeight = a.bold ? '700' : '400';
      el.style.fontStyle = a.italic ? 'italic' : 'normal';
      el.style.color = a.color;
      if (a.bg) el.style.background = a.bg;
      el.textContent = a.text;
    }
    el.dataset.id = a.id;
    if (selected && selected.id === a.id) {
      el.classList.add('selected');
      const del = document.createElement('button');
      del.className = 'ann-del'; del.textContent = '✕'; del.title = 'Delete';
      del.addEventListener('pointerdown', e => e.stopPropagation());
      del.addEventListener('click', e => { e.stopPropagation(); deleteAnnot(a); });
      el.appendChild(del);
      if (a.type === 'wo') {
        const rs = document.createElement('div');
        rs.className = 'ann-resize';
        rs.addEventListener('pointerdown', e => startResize(e, a));
        el.appendChild(rs);
      }
    }
    overlay.appendChild(el);
  }
}
function deleteAnnot(a) {
  snapshot();
  const arr = pageAnnots();
  const i = arr.findIndex(x => x.id === a.id);
  if (i >= 0) arr.splice(i, 1);
  if (selected && selected.id === a.id) selected = null;
  renderAnnots();
}
function findAnnot(id) { return pageAnnots().find(a => a.id === +id); }

/* ---------- clipboard: copy / cut / paste / duplicate ---------- */
function copySel() { if (selected) { clipboard = JSON.parse(JSON.stringify(selected)); toast('Copied'); } }
function cutSel() { if (selected) { clipboard = JSON.parse(JSON.stringify(selected)); deleteAnnot(selected); toast('Cut'); } }
function pasteClip() {
  if (!clipboard) return;
  snapshot();
  const a = JSON.parse(JSON.stringify(clipboard));
  a.id = nextId++;
  const off = 12 / k();
  a.x += off; a.y += off;
  if (a.type === 'fuzz') { const im = new Image(); im.src = a.img; imgCache.set(a.id, im); }
  pageAnnots().push(a);
  selected = a;
  renderAnnots();
}
function duplicateSel() { if (selected) { clipboard = JSON.parse(JSON.stringify(selected)); pasteClip(); } }

/* ---------- pointer interactions ---------- */
let drag = null; // {kind:'move'|'draw'|'resize', ...}

function overlayPos(e) {
  const r = overlay.getBoundingClientRect();
  return { x: Math.max(0, Math.min(e.clientX - r.left, r.width)), y: Math.max(0, Math.min(e.clientY - r.top, r.height)) };
}

overlay.addEventListener('pointerdown', e => {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  const p = overlayPos(e);
  const annEl = e.target.closest('.ann');

  if (mode === 'whiteout' || mode === 'fuzz') {
    const prev = document.createElement('div');
    prev.className = 'wo-preview';
    overlay.appendChild(prev);
    drag = { kind: 'draw', fuzz: mode === 'fuzz', sx: p.x, sy: p.y, el: prev };
    overlay.setPointerCapture(e.pointerId);
    return;
  }

  if (mode === 'match') { sampleFontAt(p); return; }

  if (mode === 'text') {
    if (annEl) { setMode('select'); selectAndMaybeDrag(annEl, p, e); return; }
    addTextAt(p.x, p.y);
    return;
  }

  // select mode
  if (annEl) {
    selectAndMaybeDrag(annEl, p, e);
  } else {
    if (selected) { selected = null; renderAnnots(); }
  }
});

function selectAndMaybeDrag(annEl, p, e) {
  const a = findAnnot(annEl.dataset.id);
  if (!a) return;
  if (annEl.classList.contains('editing')) return; // typing — don't drag
  selected = a;
  syncToolbarFrom(a);
  if (a.type === 'wo') $('woColor').value = a.fill;
  renderAnnots();
  if (a.type === 'fuzz') return; // fuzz snapshots are pinned to their spot
  drag = { kind: 'move', a, ox: p.x - a.x * k(), oy: p.y - a.y * k(), moved: false, snapped: false };
  overlay.setPointerCapture(e.pointerId);
}

function startResize(e, a) {
  e.stopPropagation();
  snapshot();
  drag = { kind: 'resize', a };
  overlay.setPointerCapture(e.pointerId);
}

overlay.addEventListener('pointermove', e => {
  if (!drag) return;
  const p = overlayPos(e), s = k();
  if (drag.kind === 'draw') {
    const x = Math.min(drag.sx, p.x), y = Math.min(drag.sy, p.y);
    const w = Math.abs(p.x - drag.sx), h = Math.abs(p.y - drag.sy);
    Object.assign(drag.el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  } else if (drag.kind === 'move') {
    if (!drag.snapped) { snapshot(); drag.snapped = true; }
    drag.moved = true;
    drag.a.x = (p.x - drag.ox) / s;
    drag.a.y = (p.y - drag.oy) / s;
    positionSelectedEl();
  } else if (drag.kind === 'resize') {
    drag.a.w = Math.max(4 / s, p.x / s - drag.a.x);
    drag.a.h = Math.max(4 / s, p.y / s - drag.a.y);
    positionSelectedEl();
  }
});

function positionSelectedEl() {
  const el = overlay.querySelector('.ann.selected');
  if (!el || !selected) return;
  const s = k();
  el.style.left = selected.x * s + 'px';
  el.style.top = selected.y * s + 'px';
  if (selected.type === 'wo') {
    el.style.width = selected.w * s + 'px';
    el.style.height = selected.h * s + 'px';
  }
}

overlay.addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag; drag = null;
  try { overlay.releasePointerCapture(e.pointerId); } catch (_) {}
  if (d.kind === 'draw') {
    const st = d.el.style;
    const px = parseFloat(st.left) || d.sx, py = parseFloat(st.top) || d.sy;
    const pw = parseFloat(st.width) || 0, ph = parseFloat(st.height) || 0;
    d.el.remove();
    if (pw < 3 || ph < 3) return; // ignore accidental clicks
    if (d.fuzz) { addFuzz(px, py, pw, ph); return; }
    const fill = woAutoMatch ? sampleSurroundingColor(px, py, pw, ph) : $('woColor').value;
    snapshot();
    const s = k();
    const a = { id: nextId++, type: 'wo', x: px / s, y: py / s, w: pw / s, h: ph / s, fill };
    pageAnnots().push(a);
    selected = a;
    $('woColor').value = fill;
    renderAnnots();
  }
});

/* double-click text to edit */
overlay.addEventListener('dblclick', e => {
  const el = e.target.closest('.ann-text');
  if (!el) return;
  const a = findAnnot(el.dataset.id);
  if (!a) return;
  beginEdit(el, a);
});

function beginEdit(el, a) {
  snapshot();
  el.classList.add('editing');
  try { el.contentEditable = 'plaintext-only'; if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true'; }
  catch (_) { el.contentEditable = 'true'; }
  el.addEventListener('input', () => { a.placeholder = false; }, { once: true });
  el.focus();
  // place caret at end
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  const done = () => {
    el.classList.remove('editing');
    el.contentEditable = 'false';
    a.text = el.innerText.replace(/ /g, ' ').replace(/\n$/, '');
    if (!a.text.trim() || a.placeholder) deleteAnnot(a);
    else { delete a.placeholder; renderAnnots(); }
  };
  el.addEventListener('blur', done, { once: true });
  el.addEventListener('keydown', ev => {
    ev.stopPropagation();
    if (ev.key === 'Escape') { ev.preventDefault(); el.blur(); }
  });
}

function addTextAt(px, py) {
  snapshot();
  const s = k();
  const size = parseFloat($('fontSize').value) || 16;
  const a = {
    id: nextId++, type: 'text',
    x: px / s, y: (py / s) - size * 0.6, // center roughly on click point
    text: 'Type here', placeholder: true,
    font: $('fontFamily').value, size,
    bold: $('boldBtn').classList.contains('active'),
    italic: $('italicBtn').classList.contains('active'),
    color: $('textColor').value,
    bg: $('bgToggle').classList.contains('active') ? $('textBg').value : null
  };
  pageAnnots().push(a);
  selected = a;
  setMode('select');
  renderAnnots();
  const el = overlay.querySelector('.ann.selected');
  if (el) {
    // select placeholder text so typing replaces it
    beginEdit(el, a);
    const r = document.createRange(); r.selectNodeContents(el);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  }
}

/* ---------- keyboard ---------- */
document.addEventListener('keydown', e => {
  const editing = document.activeElement && (document.activeElement.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName));
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z' && !editing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y' && !editing) { e.preventDefault(); redo(); return; }
  if (editing || !pdfjsDoc) return;
  if (mod && e.key.toLowerCase() === 'c') { if (selected) { e.preventDefault(); copySel(); } return; }
  if (mod && e.key.toLowerCase() === 'x') { if (selected) { e.preventDefault(); cutSel(); } return; }
  if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteClip(); return; }
  if (mod && e.key.toLowerCase() === 'd') { if (selected) { e.preventDefault(); duplicateSel(); } return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { if (selected) { e.preventDefault(); deleteAnnot(selected); } return; }
  if (e.key.startsWith('Arrow')) {
    if (selected && selected.type !== 'fuzz') {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      if (!nudgeSnapped) { snapshot(); nudgeSnapped = true; }
      if (e.key === 'ArrowLeft') selected.x -= step;
      else if (e.key === 'ArrowRight') selected.x += step;
      else if (e.key === 'ArrowUp') selected.y -= step;
      else if (e.key === 'ArrowDown') selected.y += step;
      renderAnnots();
      return;
    }
    if (e.key === 'ArrowLeft' && pageNum > 1) { pageNum--; selected = null; renderPage(); }
    if (e.key === 'ArrowRight' && pageNum < pageCount) { pageNum++; selected = null; renderPage(); }
    return;
  }
  if (e.key === 'v' || e.key === 'V') setMode('select');
  if (e.key === 't' || e.key === 'T') setMode('text');
  if (e.key === 'w' || e.key === 'W') setMode('whiteout');
  if (e.key === 'f' || e.key === 'F') setMode('fuzz');
  if (e.key === 'e' || e.key === 'E') setMode('match');
  if (e.key === 'Escape') { selected = null; setMode('select'); renderAnnots(); }
});
document.addEventListener('keyup', e => { if (e.key.startsWith('Arrow')) nudgeSnapped = false; });

/* ---------- save ---------- */
$('saveBtn').addEventListener('click', save);
async function save() {
  if (!originalBytes) return;
  const total = Object.values(annots).reduce((n, a) => n + a.length, 0);
  if (!total) return toast('Nothing to save yet — add some text or whiteout first.', 'error');
  $('progressWrap').style.display = 'block';
  $('progressFill').style.width = '15%';
  $('progressLabel').textContent = 'Applying your edits…';
  try {
    const doc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
    try { if (window.fontkit) doc.registerFontkit(window.fontkit); } catch (_) {}
    const pages = doc.getPages();
    // embed only fonts actually used
    const fontCache = {};
    async function getFont(fam, bold, italic) {
      const key = fam + (bold ? 'B' : '') + (italic ? 'I' : '');
      if (fontCache[key]) return fontCache[key];
      if (STD_FONTS[fam]) {
        const v = STD_FONTS[fam];
        const name = bold && italic ? v.bi : bold ? v.b : italic ? v.i : v.n;
        fontCache[key] = await doc.embedFont(StandardFonts[name]);
      } else if (CUSTOM_FONTS[fam]) {
        const f = CUSTOM_FONTS[fam].files;
        const url = bold && italic ? f.bi : bold ? f.b : italic ? f.i : f.r;
        try {
          const bytes = await loadFontBytes(url);
          fontCache[key] = await doc.embedFont(bytes, { subset: true });
        } catch (_) {
          fontCache[key] = await getFont('Helvetica', bold, italic);
        }
      } else {
        fontCache[key] = await getFont('Helvetica', bold, italic);
      }
      return fontCache[key];
    }
    let done = 0;
    for (const [pn, arr] of Object.entries(annots)) {
      const page = pages[pn - 1];
      if (!page) continue;
      const H = page.getHeight();
      for (const a of arr) {
        if (a.type === 'wo') {
          const c = hexToRgb(a.fill);
          page.drawRectangle({
            x: a.x, y: H - a.y - a.h, width: a.w, height: a.h,
            color: rgb(c.r / 255, c.g / 255, c.b / 255)
          });
        } else if (a.type === 'fuzz') {
          const pngBytes = await fetch(a.img).then(r => r.arrayBuffer());
          const png = await doc.embedPng(pngBytes);
          page.drawImage(png, { x: a.x, y: H - a.y - a.h, width: a.w, height: a.h });
        } else if (a.text && a.text.trim()) {
          const font = await getFont(a.font, a.bold, a.italic);
          const c = hexToRgb(a.color);
          const lineH = a.size * 1.2;
          const lines = a.text.split('\n');
          lines.forEach((line, i) => {
            if (!line) return;
            const topY = a.y + i * lineH;
            if (a.bg) {
              const bgc = hexToRgb(a.bg);
              const w = font.widthOfTextAtSize(line, a.size);
              page.drawRectangle({
                x: a.x, y: H - topY - lineH, width: w, height: lineH,
                color: rgb(bgc.r / 255, bgc.g / 255, bgc.b / 255)
              });
            }
            // CSS line box baseline ≈ top + 0.92 * fontSize for line-height 1.2
            const baselineFromTop = topY + a.size * 0.92;
            page.drawText(line, {
              x: a.x, y: H - baselineFromTop, size: a.size, font,
              color: rgb(c.r / 255, c.g / 255, c.b / 255)
            });
          });
        }
        done++;
        $('progressFill').style.width = (15 + 70 * done / total) + '%';
      }
    }
    $('progressLabel').textContent = 'Building PDF…';
    const out = await doc.save();
    $('progressFill').style.width = '100%';
    const blob = new Blob([out], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName.replace(/\.pdf$/i, '') + '-edited.pdf';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('Saved! Your edited PDF is downloading.', 'success');
    if (typeof gtag === 'function') gtag('event', 'pdf_edit_save', { pages: pageCount, edits: total });
  } catch (err) {
    console.error(err);
    toast('Save failed: ' + (err.message || 'unknown error'), 'error');
  } finally {
    setTimeout(() => { $('progressWrap').style.display = 'none'; $('progressFill').style.width = '0%'; }, 800);
  }
}

/* ---------- autosave & crash recovery (IndexedDB) ---------- */
const DB_NAME = 'evrythingpdf-editor', STORE = 'session', SKEY = 'last';
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbPut(val) {
  try { const db = await idb(); await new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(val, SKEY); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); } catch (_) {}
}
async function idbGet() {
  try { const db = await idb(); return await new Promise((res) => { const tx = db.transaction(STORE, 'readonly'); const rq = tx.objectStore(STORE).get(SKEY); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); }); } catch (_) { return null; }
}
async function idbClear() {
  try { const db = await idb(); await new Promise((res) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(SKEY); tx.oncomplete = res; tx.onerror = res; }); } catch (_) {}
}
let autosaveT;
function scheduleAutosave() {
  if (!originalBytes) return;
  clearTimeout(autosaveT);
  autosaveT = setTimeout(() => {
    idbPut({ fileName, bytes: originalBytes, annots, nextId, pageNum, savedAt: Date.now() });
  }, 900);
}
async function restoreSession(rec) {
  try {
    fileName = rec.fileName || 'document.pdf';
    originalBytes = rec.bytes instanceof Uint8Array ? rec.bytes : new Uint8Array(rec.bytes);
    await workerReady;
    pdfjsDoc = await pdfjsLib.getDocument({ data: originalBytes.slice() }).promise;
    pageCount = pdfjsDoc.numPages;
    annots = rec.annots || {}; nextId = rec.nextId || 1; pageNum = Math.min(rec.pageNum || 1, pageCount);
    undoStack = []; redoStack = []; selected = null;
    for (const arr of Object.values(annots)) for (const a of arr) if (a.type === 'fuzz' && a.img) { const im = new Image(); im.src = a.img; imgCache.set(a.id, im); }
    const p1 = await pdfjsDoc.getPage(1);
    const vp = p1.getViewport({ scale: 1 });
    const avail = Math.min(document.querySelector('.editor-shell').clientWidth - 50, 1000);
    baseScale = Math.min(1.6, Math.max(0.8, avail / vp.width));
    dropZone.style.display = 'none';
    ['toolbar','stage'].forEach(id => $(id).style.display = 'flex');
    $('stage').style.display = 'block';
    $('pageNav').style.display = pageCount > 1 ? 'flex' : 'none';
    $('actions').style.display = 'flex';
    $('hint').style.display = 'block';
    await renderPage();
    toast('Restored your last session — ' + fileName, 'success');
  } catch (_) { idbClear(); }
}
(async function checkRestore() {
  const rec = await idbGet();
  if (rec && rec.bytes && Object.values(rec.annots || {}).some(a => a.length)) {
    if (confirm('Restore your unsaved edits to "' + (rec.fileName || 'your PDF') + '"?')) restoreSession(rec);
    else idbClear();
  }
})();

/* re-fit on window resize */
let rsT;
window.addEventListener('resize', () => {
  if (!pdfjsDoc) return;
  clearTimeout(rsT);
  rsT = setTimeout(renderPage, 200);
});
