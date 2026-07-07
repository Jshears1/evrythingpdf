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
  Poppins: 'Poppins, sans-serif',
  PTSans: '"PT Sans", sans-serif',
  FiraSans: '"Fira Sans", sans-serif',
  PTSerif: '"PT Serif", Georgia, serif',
  IBMPlexSerif: '"IBM Plex Serif", Georgia, serif',
  CrimsonText: '"Crimson Text", Georgia, serif',
  IBMPlexMono: '"IBM Plex Mono", "Courier New", monospace'
};
// Self-hosted real fonts embedded on save (subset). Keys mirror the dropdown.
const CUSTOM_FONTS = {
  Carlito: { files: { r: 'fonts/Carlito-Regular.ttf', b: 'fonts/Carlito-Bold.ttf', i: 'fonts/Carlito-Italic.ttf', bi: 'fonts/Carlito-BoldItalic.ttf' } },
  Lato:    { files: { r: 'fonts/Lato-Regular.ttf', b: 'fonts/Lato-Bold.ttf', i: 'fonts/Lato-Italic.ttf', bi: 'fonts/Lato-BoldItalic.ttf' } },
  Poppins: { files: { r: 'fonts/Poppins-Regular.ttf', b: 'fonts/Poppins-Bold.ttf', i: 'fonts/Poppins-Italic.ttf', bi: 'fonts/Poppins-BoldItalic.ttf' } },
  PTSans:  { files: { r: 'fonts/PTSans-Regular.ttf', b: 'fonts/PTSans-Bold.ttf', i: 'fonts/PTSans-Italic.ttf', bi: 'fonts/PTSans-BoldItalic.ttf' } },
  FiraSans:{ files: { r: 'fonts/FiraSans-Regular.ttf', b: 'fonts/FiraSans-Bold.ttf', i: 'fonts/FiraSans-Italic.ttf', bi: 'fonts/FiraSans-BoldItalic.ttf' } },
  PTSerif: { files: { r: 'fonts/PTSerif-Regular.ttf', b: 'fonts/PTSerif-Bold.ttf', i: 'fonts/PTSerif-Italic.ttf', bi: 'fonts/PTSerif-BoldItalic.ttf' } },
  IBMPlexSerif: { files: { r: 'fonts/IBMPlexSerif-Regular.ttf', b: 'fonts/IBMPlexSerif-Bold.ttf', i: 'fonts/IBMPlexSerif-Italic.ttf', bi: 'fonts/IBMPlexSerif-BoldItalic.ttf' } },
  CrimsonText:  { files: { r: 'fonts/CrimsonText-Regular.ttf', b: 'fonts/CrimsonText-Bold.ttf', i: 'fonts/CrimsonText-Italic.ttf', bi: 'fonts/CrimsonText-BoldItalic.ttf' } },
  IBMPlexMono:  { files: { r: 'fonts/IBMPlexMono-Regular.ttf', b: 'fonts/IBMPlexMono-Bold.ttf', i: 'fonts/IBMPlexMono-Italic.ttf', bi: 'fonts/IBMPlexMono-BoldItalic.ttf' } }
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
    renderTextLayer();
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
// Contextual toolbar groups: show a tool's options when that tool is active OR
// when an annotation of that type is selected (so you can restyle it).
function showGroup(id, on) { const g = $(id); if (g) g.style.display = on ? 'flex' : 'none'; }
function updateContextGroups() {
  const t = selected && selected.type;
  showGroup('textOpts', mode === 'text' || t === 'text');
  showGroup('fillOpts', mode === 'whiteout' || mode === 'erase' || t === 'wo');
  showGroup('eraseOpts', mode === 'erase');
  showGroup('fuzzOpts', mode === 'fuzz' || t === 'fuzz');
  showGroup('shapeOpts', mode === 'shape' || t === 'shape');
  showGroup('textselOpts', mode === 'textsel');
}
function setMode(m) {
  mode = m;
  overlay.className = 'mode-' + m;
  $('toolSelect').classList.toggle('active', m === 'select');
  $('toolText').classList.toggle('active', m === 'text');
  $('toolEdit') && $('toolEdit').classList.toggle('active', m === 'editxt');
  $('toolWhiteout').classList.toggle('active', m === 'whiteout');
  $('toolErase') && $('toolErase').classList.toggle('active', m === 'erase');
  $('toolFuzz').classList.toggle('active', m === 'fuzz');
  $('toolShape') && $('toolShape').classList.toggle('active', m === 'shape');
  $('toolTextsel') && $('toolTextsel').classList.toggle('active', m === 'textsel');
  $('toolMatch').classList.toggle('active', m === 'match');
  // Text-select mode: let the pdf.js text layer receive the pointer for
  // selection; every other mode lets the annotation overlay own the pointer.
  const tl = $('textLayer');
  if (tl) { const on = m === 'textsel'; tl.style.pointerEvents = on ? 'auto' : 'none'; tl.style.userSelect = on ? 'text' : 'none'; }
  overlay.style.pointerEvents = m === 'textsel' ? 'none' : 'auto';
  updateContextGroups();
  if (m !== 'select') { selected = null; renderAnnots(); }
}
$('toolSelect').addEventListener('click', () => setMode('select'));
$('toolText').addEventListener('click', () => setMode('text'));
$('toolEdit') && $('toolEdit').addEventListener('click', () => setMode('editxt'));
$('toolWhiteout').addEventListener('click', () => setMode('whiteout'));
$('toolErase') && $('toolErase').addEventListener('click', () => setMode('erase'));
$('toolFuzz').addEventListener('click', () => setMode('fuzz'));
$('toolShape') && $('toolShape').addEventListener('click', () => setMode('shape'));
$('toolTextsel') && $('toolTextsel').addEventListener('click', () => setMode('textsel'));
$('toolMatch').addEventListener('click', () => setMode('match'));
$('copyTextBtn') && $('copyTextBtn').addEventListener('click', copyPageText);

// Quick color swatches (text color).
document.querySelectorAll('.swatch').forEach(sw => sw.addEventListener('click', () => {
  $('textColor').value = sw.dataset.color; applyStyleToSelected();
}));

// Shape controls — live-update the selected shape.
$('shapeFillOn') && $('shapeFillOn').addEventListener('click', () => {
  $('shapeFillOn').classList.toggle('active');
  if (selected && selected.type === 'shape') { snapshot(); selected.fill = $('shapeFillOn').classList.contains('active') ? $('shapeFill').value : null; renderAnnots(); }
});
$('shapeType') && $('shapeType').addEventListener('change', () => { if (selected && selected.type === 'shape') { snapshot(); selected.shape = $('shapeType').value; renderAnnots(); } });
$('shapeStroke') && $('shapeStroke').addEventListener('input', () => { if (selected && selected.type === 'shape') { selected.stroke = $('shapeStroke').value; renderAnnots(); } });
$('shapeFill') && $('shapeFill').addEventListener('input', () => { if (selected && selected.type === 'shape' && selected.fill) { selected.fill = $('shapeFill').value; renderAnnots(); } });
$('shapeWidth') && $('shapeWidth').addEventListener('input', () => { if (selected && selected.type === 'shape') { selected.sw = parseFloat($('shapeWidth').value) || 2; renderAnnots(); } });

// Share nudge.
function shareTool() {
  const url = location.origin + location.pathname;
  const data = { title: 'EvrythingPDF — free PDF editor', text: 'Edit, redact and annotate PDFs free in your browser — no upload, no signup.', url };
  if (navigator.share) navigator.share(data).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('Link copied — thanks for sharing!', 'success'), () => toast(url));
  else toast(url);
}
$('shareBtn') && $('shareBtn').addEventListener('click', shareTool);

// Fuzz strength slider + blur/pixelate toggle. Adjusting with a fuzz box
// selected re-blurs it live; otherwise just sets the default for the next draw.
if ($('fuzzStrength')) {
  $('fuzzStrength').addEventListener('input', () => {
    const lbl = $('fuzzStrengthVal'); if (lbl) lbl.textContent = fuzzStrengthVal();
  });
  $('fuzzStrength').addEventListener('change', () => { if (selected && selected.type === 'fuzz') reblurSelectedFuzz(); });
}
if ($('fuzzMode')) {
  $('fuzzMode').addEventListener('click', () => {
    const on = !$('fuzzMode').classList.contains('active');
    $('fuzzMode').classList.toggle('active', on);
    $('fuzzMode').textContent = on ? 'Pixelate' : 'Blur';
    if (selected && selected.type === 'fuzz') reblurSelectedFuzz();
  });
}

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
  else if (/pt ?sans|ptsans/.test(name)) fam = 'PTSans';
  else if (/fira ?sans|firasans/.test(name)) fam = 'FiraSans';
  else if (/plex ?mono|ibmplexmono/.test(name)) fam = 'IBMPlexMono';
  else if (/plex ?serif|ibmplexserif/.test(name)) fam = 'IBMPlexSerif';
  else if (/crimson/.test(name)) fam = 'CrimsonText';
  else if (/pt ?serif|ptserif/.test(name)) fam = 'PTSerif';
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

/* One-click edit existing text: whiteout the clicked word/line and drop a
   matched, pre-filled text box in its place. Recombines the eyedropper,
   whiteout-with-color-match, and text tools. */
async function editExistingTextAt(p) {
  await ensurePageText();
  const s = k();
  const pdfX = p.x / s;
  const Hpt = pageDims[pageNum] ? pageDims[pageNum].h : 0;
  const pdfY = Hpt - p.y / s;
  const tc = pageText[pageNum];
  let hit = null;
  if (tc) for (const it of tc.items) {
    if (!it.str || !it.str.trim()) continue;
    const tr = it.transform, ix = tr[4], iy = tr[5];
    const sz = Math.hypot(tr[2], tr[3]) || Math.abs(tr[3]) || it.height || 10;
    const w = it.width || sz * it.str.length * 0.5;
    if (pdfX >= ix - 1 && pdfX <= ix + w + 1 && pdfY >= iy - sz * 0.35 && pdfY <= iy + sz * 0.95) { hit = { it, sz, ix, iy, w }; break; }
  }
  if (!hit) { toast('No selectable text there — for scanned PDFs run the OCR tool first.'); return; }
  const m = mapFont(hit.it.fontName, tc);
  const size = Math.max(6, Math.min(144, Math.round(hit.sz)));
  const color = sampleTextColor(p.x, p.y);
  snapshot();
  const boxX = hit.ix, boxY = Hpt - hit.iy - hit.sz * 0.9, boxW = hit.w, boxH = hit.sz * 1.28;
  const bg = sampleSurroundingColor(boxX * s, boxY * s, boxW * s, boxH * s);
  const wo = { id: nextId++, type: 'wo', x: boxX, y: boxY, w: boxW, h: boxH, fill: bg };
  const tx = {
    id: nextId++, type: 'text', x: hit.ix, y: Hpt - hit.iy - size * 0.92,
    text: hit.it.str, font: m.fam, size, bold: m.bold, italic: m.italic, color, bg: null
  };
  const arr = pageAnnots(); arr.push(wo); arr.push(tx);
  selected = tx; setMode('select'); syncToolbarFrom(tx); renderAnnots();
  const el = overlay.querySelector('.ann.selected');
  if (el) beginEdit(el, tx);
  toast('Editing existing text — edit or retype, then click away', 'success');
}

/* ---------- pdf.js text layer (select & copy the original PDF text) ---------- */
async function renderTextLayer() {
  const tl = $('textLayer');
  if (!tl || !curPageObj) return;
  tl.innerHTML = '';
  try {
    const vp = curPageObj.getViewport({ scale: k() });
    tl.style.width = vp.width + 'px';
    tl.style.height = vp.height + 'px';
    tl.style.setProperty('--scale-factor', k());
    const tc = await curPageObj.getTextContent();
    const task = pdfjsLib.renderTextLayer({ textContentSource: tc, textContent: tc, container: tl, viewport: vp });
    if (task && task.promise) await task.promise;
  } catch (_) {}
}
function copyPageText() {
  const tl = $('textLayer');
  const txt = tl ? tl.innerText.replace(/\n{2,}/g, '\n').trim() : '';
  if (!txt) { toast('No selectable text on this page — try the OCR tool for scanned PDFs.'); return; }
  navigator.clipboard.writeText(txt).then(
    () => toast('Copied this page\'s text to your clipboard', 'success'),
    () => toast('Copy failed — your browser blocked clipboard access', 'error')
  );
}

/* ---------- fuzz (light blur, one layer per pass) ---------- */
const imgCache = new Map(); // annot id -> loaded Image (survives undo snapshots)
const fontBytesCache = {};
async function loadFontBytes(url) {
  if (!fontBytesCache[url]) fontBytesCache[url] = await fetch(url).then(r => { if (!r.ok) throw new Error('font ' + r.status); return r.arrayBuffer(); });
  return fontBytesCache[url];
}

function fuzzStrengthVal() {
  const v = parseInt($('fuzzStrength') && $('fuzzStrength').value, 10);
  return Math.min(10, Math.max(1, v || 5));
}
function fuzzIsPixelate() {
  return !!($('fuzzMode') && $('fuzzMode').classList.contains('active'));
}
function makeFuzzSnapshot(px, py, pw, ph, strength, pixelate, excludeId) {
  // Composite the rendered page region plus any overlapping whiteout/fuzz
  // annotations, then obscure it. strength 1–10 scales the effect from barely
  // perceptible to fully destroyed. pixelate=true => hard mosaic blocks
  // (redaction-grade at high strength); false => gaussian blur.
  // excludeId skips one annotation from the composite (used when re-blurring a
  // selected fuzz box so its own prior image doesn't stack). Returns PNG data URL.
  strength = Math.min(10, Math.max(1, strength || 5));
  const dpr = canvas.width / canvas.clientWidth;
  const sx = px * dpr, sy = py * dpr, sw = Math.max(1, pw * dpr), sh = Math.max(1, ph * dpr);
  const tmp = document.createElement('canvas');
  tmp.width = Math.round(sw); tmp.height = Math.round(sh);
  const tc = tmp.getContext('2d');
  tc.drawImage(canvas, sx, sy, sw, sh, 0, 0, tmp.width, tmp.height);
  const s = k();
  for (const a of pageAnnots()) {
    if (excludeId != null && a.id === excludeId) continue;
    const ax = (a.x * s - px) * dpr, ay = (a.y * s - py) * dpr;
    if (a.type === 'wo') {
      tc.fillStyle = a.fill;
      tc.fillRect(ax, ay, a.w * s * dpr, a.h * s * dpr);
    } else if (a.type === 'fuzz') {
      const im = imgCache.get(a.id);
      if (im && im.complete) tc.drawImage(im, ax, ay, a.w * s * dpr, a.h * s * dpr);
    }
  }
  if (pixelate) {
    // mosaic: block size grows with strength (~3px .. ~30px in CSS px).
    const block = Math.max(2, Math.round(((strength / 10) * 27 + 3) * dpr));
    const dsW = Math.max(1, Math.round(tmp.width / block));
    const dsH = Math.max(1, Math.round(tmp.height / block));
    const t2 = document.createElement('canvas'); t2.width = dsW; t2.height = dsH;
    t2.getContext('2d').drawImage(tmp, 0, 0, dsW, dsH);
    tc.clearRect(0, 0, tmp.width, tmp.height);
    tc.imageSmoothingEnabled = false; // hard-edged blocks
    tc.drawImage(t2, 0, 0, dsW, dsH, 0, 0, tmp.width, tmp.height);
    tc.imageSmoothingEnabled = true;
  } else {
    // gaussian blur: radius + downscale both scale with strength.
    const radius = Math.max(1, (strength / 10) * 9 * dpr);
    const ds = 1 + (strength / 10) * 4; // stronger => rougher downscale
    const t2 = document.createElement('canvas');
    t2.width = Math.max(1, Math.round(tmp.width / ds));
    t2.height = Math.max(1, Math.round(tmp.height / ds));
    t2.getContext('2d').drawImage(tmp, 0, 0, t2.width, t2.height);
    tc.clearRect(0, 0, tmp.width, tmp.height);
    try { tc.filter = 'blur(' + radius + 'px)'; } catch (_) {}
    tc.drawImage(t2, 0, 0, t2.width, t2.height, 0, 0, tmp.width, tmp.height);
    try { tc.filter = 'none'; } catch (_) {}
  }
  return tmp.toDataURL('image/png');
}

function addFuzz(px, py, pw, ph) {
  const strength = fuzzStrengthVal(), pixelate = fuzzIsPixelate();
  const url = makeFuzzSnapshot(px, py, pw, ph, strength, pixelate);
  snapshot();
  const s = k();
  const a = { id: nextId++, type: 'fuzz', x: px / s, y: py / s, w: pw / s, h: ph / s, img: url, strength, pixelate };
  const im = new Image(); im.src = url;
  imgCache.set(a.id, im);
  pageAnnots().push(a);
  selected = a;
  renderAnnots();
}

// Re-generate the selected fuzz box from the clean page at a new strength/mode
// without stacking (excludes its own prior image from the composite).
function reblurSelectedFuzz() {
  if (!selected || selected.type !== 'fuzz') return;
  const s = k();
  const px = selected.x * s, py = selected.y * s, pw = selected.w * s, ph = selected.h * s;
  const strength = fuzzStrengthVal(), pixelate = fuzzIsPixelate();
  snapshot();
  const url = makeFuzzSnapshot(px, py, pw, ph, strength, pixelate, selected.id);
  selected.img = url; selected.strength = strength; selected.pixelate = pixelate;
  const im = new Image(); im.src = url;
  imgCache.set(selected.id, im);
  renderAnnots();
}

/* ---------- freehand erase / paint brush ----------
   Paint whiteout along a freehand stroke. Color auto-matches the page
   background at the stroke start (or uses the manual fill color). Captured as a
   cropped PNG 'paint' annotation — rendered, moved, flattened and saved exactly
   like a fuzz image. */
let paintState = null;
function beginPaint(p, e) {
  const rect = overlay.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cv = document.createElement('canvas');
  cv.className = 'paint-live';
  cv.width = Math.round(rect.width * dpr);
  cv.height = Math.round(rect.height * dpr);
  cv.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;width:' + rect.width + 'px;height:' + rect.height + 'px';
  overlay.appendChild(cv);
  const c = cv.getContext('2d');
  c.scale(dpr, dpr);
  const brush = Math.max(4, parseInt($('brushSize') && $('brushSize').value, 10) || 22);
  const color = woAutoMatch ? sampleSurroundingColor(p.x - brush / 2, p.y - brush / 2, brush, brush) : $('woColor').value;
  c.strokeStyle = color; c.fillStyle = color;
  c.lineJoin = c.lineCap = 'round'; c.lineWidth = brush;
  c.beginPath(); c.arc(p.x, p.y, brush / 2, 0, 7); c.fill();
  paintState = { cv, c, brush, minX: p.x - brush, minY: p.y - brush, maxX: p.x + brush, maxY: p.y + brush, last: p };
  try { overlay.setPointerCapture(e.pointerId); } catch (_) {}
}
function paintMove(p) {
  const st = paintState, b = st.brush;
  st.c.beginPath(); st.c.moveTo(st.last.x, st.last.y); st.c.lineTo(p.x, p.y); st.c.stroke();
  st.last = p;
  st.minX = Math.min(st.minX, p.x - b); st.minY = Math.min(st.minY, p.y - b);
  st.maxX = Math.max(st.maxX, p.x + b); st.maxY = Math.max(st.maxY, p.y + b);
}
function endPaint() {
  const st = paintState; paintState = null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = overlay.getBoundingClientRect();
  const x0 = Math.max(0, st.minX), y0 = Math.max(0, st.minY);
  const x1 = Math.min(rect.width, st.maxX), y1 = Math.min(rect.height, st.maxY);
  const w = x1 - x0, h = y1 - y0;
  if (w < 3 || h < 3) { st.cv.remove(); return; }
  const out = document.createElement('canvas');
  out.width = Math.round(w * dpr); out.height = Math.round(h * dpr);
  out.getContext('2d').drawImage(st.cv, x0 * dpr, y0 * dpr, w * dpr, h * dpr, 0, 0, out.width, out.height);
  st.cv.remove();
  const url = out.toDataURL('image/png');
  snapshot();
  const s = k();
  const a = { id: nextId++, type: 'paint', x: x0 / s, y: y0 / s, w: w / s, h: h / s, img: url };
  const im = new Image(); im.src = url; imgCache.set(a.id, im);
  pageAnnots().push(a); selected = a; renderAnnots();
}

/* ---------- shapes (rect, ellipse, line, arrow, check, x) ----------
   Vector annotations. Drawn as crisp inline SVG in the editor; saved with
   pdf-lib vector primitives (see save()) and baked with canvas ops when
   flattening (see renderFlatPage). flipX/flipY carry the drag direction so
   lines and arrows point the way the user dragged. */
function addShape(px, py, pw, ph, flipX, flipY) {
  snapshot();
  const s = k();
  const fillOn = $('shapeFillOn') && $('shapeFillOn').classList.contains('active');
  const a = {
    id: nextId++, type: 'shape',
    shape: ($('shapeType') && $('shapeType').value) || 'rect',
    x: px / s, y: py / s, w: pw / s, h: ph / s,
    stroke: ($('shapeStroke') && $('shapeStroke').value) || '#e53935',
    fill: fillOn ? ($('shapeFill') && $('shapeFill').value) || '#ffff00' : null,
    sw: parseFloat($('shapeWidth') && $('shapeWidth').value) || 2,
    flipX: !!flipX, flipY: !!flipY
  };
  pageAnnots().push(a); selected = a; renderAnnots();
}
function shapeSVG(a, s) {
  const W = Math.max(1, a.w * s), H = Math.max(1, a.h * s), sw = Math.max(0.5, (a.sw || 2) * s);
  const stroke = a.stroke || '#e53935', fill = a.fill || 'none';
  const pad = sw, x1 = a.flipX ? W - pad : pad, x2 = a.flipX ? pad : W - pad;
  const y1 = a.flipY ? H - pad : pad, y2 = a.flipY ? pad : H - pad;
  let inner = '';
  switch (a.shape) {
    case 'ellipse':
      inner = '<ellipse cx="' + W / 2 + '" cy="' + H / 2 + '" rx="' + Math.max(0, (W - sw) / 2) + '" ry="' + Math.max(0, (H - sw) / 2) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>'; break;
    case 'line':
      inner = '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round"/>'; break;
    case 'arrow': {
      const ang = Math.atan2(y2 - y1, x2 - x1), ah = Math.max(7, sw * 3.2);
      const ax1 = x2 - ah * Math.cos(ang - Math.PI / 6), ay1 = y2 - ah * Math.sin(ang - Math.PI / 6);
      const ax2 = x2 - ah * Math.cos(ang + Math.PI / 6), ay2 = y2 - ah * Math.sin(ang + Math.PI / 6);
      inner = '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round"/>' +
              '<polyline points="' + ax1 + ',' + ay1 + ' ' + x2 + ',' + y2 + ' ' + ax2 + ',' + ay2 + '" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"/>'; break;
    }
    case 'check':
      inner = '<polyline points="' + W * 0.15 + ',' + H * 0.55 + ' ' + W * 0.42 + ',' + H * 0.82 + ' ' + W * 0.85 + ',' + H * 0.2 + '" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"/>'; break;
    case 'x':
      inner = '<line x1="' + W * 0.18 + '" y1="' + H * 0.18 + '" x2="' + W * 0.82 + '" y2="' + H * 0.82 + '" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round"/>' +
              '<line x1="' + W * 0.82 + '" y1="' + H * 0.18 + '" x2="' + W * 0.18 + '" y2="' + H * 0.82 + '" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round"/>'; break;
    default: // rect
      inner = '<rect x="' + sw / 2 + '" y="' + sw / 2 + '" width="' + Math.max(0, W - sw) + '" height="' + Math.max(0, H - sw) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
  }
  return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;display:block">' + inner + '</svg>';
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
    } else if (a.type === 'fuzz' || a.type === 'paint') {
      el = document.createElement('img');
      el.className = 'ann ann-fuzz';
      el.draggable = false;
      el.src = a.img;
      el.style.left = a.x * s + 'px';
      el.style.top = a.y * s + 'px';
      el.style.width = a.w * s + 'px';
      el.style.height = a.h * s + 'px';
    } else if (a.type === 'shape') {
      el = document.createElement('div');
      el.className = 'ann ann-shape';
      el.style.left = a.x * s + 'px';
      el.style.top = a.y * s + 'px';
      el.style.width = a.w * s + 'px';
      el.style.height = a.h * s + 'px';
      el.innerHTML = '<div class="shape-svg" style="position:absolute;inset:0">' + shapeSVG(a, s) + '</div>';
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
      if (a.type === 'wo' || a.type === 'shape') {
        const rs = document.createElement('div');
        rs.className = 'ann-resize';
        rs.addEventListener('pointerdown', e => startResize(e, a));
        el.appendChild(rs);
      }
    }
    overlay.appendChild(el);
  }
  updateContextGroups();
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
  if (a.type === 'fuzz' || a.type === 'paint') { const im = new Image(); im.src = a.img; imgCache.set(a.id, im); }
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

  if (mode === 'erase') { beginPaint(p, e); return; }

  if (mode === 'whiteout' || mode === 'fuzz' || mode === 'shape') {
    const prev = document.createElement('div');
    prev.className = 'wo-preview' + (mode === 'shape' ? ' shape-preview' : '');
    overlay.appendChild(prev);
    drag = { kind: 'draw', tool: mode, sx: p.x, sy: p.y, el: prev };
    overlay.setPointerCapture(e.pointerId);
    return;
  }

  if (mode === 'match') { sampleFontAt(p); return; }
  if (mode === 'editxt') { editExistingTextAt(p); return; }

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
  if (paintState) { paintMove(overlayPos(e)); return; }
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
  if (selected.type === 'wo' || selected.type === 'shape') {
    el.style.width = selected.w * s + 'px';
    el.style.height = selected.h * s + 'px';
    if (selected.type === 'shape') { const sv = el.querySelector('.shape-svg'); if (sv) sv.innerHTML = shapeSVG(selected, s); }
  }
}

overlay.addEventListener('pointerup', e => {
  if (paintState) { try { overlay.releasePointerCapture(e.pointerId); } catch (_) {} endPaint(); return; }
  if (!drag) return;
  const d = drag; drag = null;
  try { overlay.releasePointerCapture(e.pointerId); } catch (_) {}
  if (d.kind === 'draw') {
    const st = d.el.style;
    const px = parseFloat(st.left) || d.sx, py = parseFloat(st.top) || d.sy;
    const pw = parseFloat(st.width) || 0, ph = parseFloat(st.height) || 0;
    const p = overlayPos(e);
    d.el.remove();
    if (pw < 3 || ph < 3) return; // ignore accidental clicks
    if (d.tool === 'fuzz') { addFuzz(px, py, pw, ph); return; }
    if (d.tool === 'shape') { addShape(px, py, pw, ph, p.x < d.sx, p.y < d.sy); return; }
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
  if (e.key === 'x' || e.key === 'X') setMode('erase');
  if (e.key === 'f' || e.key === 'F') setMode('fuzz');
  if (e.key === 's' || e.key === 'S') setMode('shape');
  if (e.key === 'c' || e.key === 'C') setMode('textsel');
  if (e.key === 'e' || e.key === 'E') setMode('match');
  if (e.key === 'Escape') { selected = null; setMode('select'); renderAnnots(); }
});
document.addEventListener('keyup', e => { if (e.key.startsWith('Arrow')) nudgeSnapped = false; });

/* ---------- PII auto-detect (suggest redaction boxes) ----------
   Scan the pdf.js text layer for SSNs, emails, and card numbers, then drop a
   black whiteout box over each match. Boxes are suggestions — the user reviews
   them and (optionally) ticks "Flatten & redact" on save for true removal.
   Only works on PDFs with a real text layer; scanned/image PDFs need OCR first. */
const PII_PATTERNS = [
  { name: 'SSN',   re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { name: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { name: 'card',  re: /\b(?:\d[ -]?){13,16}\b/g }
];
async function scanPII() {
  if (!pdfjsDoc) return;
  const btn = $('scanPiiBtn'); if (btn) btn.disabled = true;
  try {
    const hits = []; // {pn, a}
    let totalChars = 0, firstPage = null;
    for (let pn = 1; pn <= pageCount; pn++) {
      const page = await pdfjsDoc.getPage(pn);
      const H = page.getViewport({ scale: 1 }).height;
      const tc = await page.getTextContent();
      for (const it of tc.items) {
        const str = it.str;
        if (!str || !str.trim()) continue;
        totalChars += str.trim().length;
        const tr = it.transform, e = tr[4], f = tr[5];
        const sz = Math.hypot(tr[2], tr[3]) || Math.abs(tr[3]) || it.height || 10;
        const iw = it.width || sz * str.length * 0.5;
        const perChar = iw / str.length;
        for (const { name, re } of PII_PATTERNS) {
          re.lastIndex = 0;
          let m;
          while ((m = re.exec(str))) {
            if (name === 'card') {
              const digits = m[0].replace(/\D/g, '').length;
              if (digits < 13 || digits > 16) continue; // real cards are 13–16 digits
            }
            const start = m.index, len = m[0].length;
            hits.push({ pn, a: {
              id: nextId++, type: 'wo',
              x: e + start * perChar,
              y: H - f - sz * 0.85,
              w: Math.max(perChar, len * perChar),
              h: sz * 1.15,
              fill: '#000000'
            } });
            if (firstPage === null) firstPage = pn;
          }
        }
      }
    }
    if (!hits.length) {
      if (totalChars < 5) toast('This PDF has no selectable text — looks scanned. Run the OCR tool first, then redact.', 'error');
      else toast('No SSNs, emails, or card numbers found in the text.');
      return;
    }
    snapshot();
    for (const h of hits) (annots[h.pn] || (annots[h.pn] = [])).push(h.a);
    if (firstPage && firstPage !== pageNum) { pageNum = firstPage; selected = null; await renderPage(); }
    else renderAnnots();
    toast('Found ' + hits.length + ' possible PII item' + (hits.length > 1 ? 's' : '') + ' — review the boxes, then Save. Tick "Flatten & redact" to remove permanently.', 'success');
  } catch (err) {
    console.error(err);
    toast('PII scan failed: ' + (err.message || err), 'error');
  } finally {
    const b = $('scanPiiBtn'); if (b) b.disabled = false;
  }
}

/* ---------- true redaction / flatten ----------
   Rasterize every page with its annotations baked in, then rebuild the PDF
   as full-page images. Destroys all underlying text/vectors — whiteout stops
   being a cover-up and becomes real redaction. Output is not text-selectable. */
function loadImg(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}
// Bake a shape onto a top-left-origin canvas (flatten path).
function drawShapeCanvas(c, a, scale) {
  const x = a.x * scale, y = a.y * scale, W = a.w * scale, H = a.h * scale, sw = Math.max(0.5, (a.sw || 2) * scale);
  c.save();
  c.strokeStyle = a.stroke || '#e53935'; c.lineWidth = sw; c.lineCap = 'round'; c.lineJoin = 'round';
  const pad = sw;
  const X1 = x + (a.flipX ? W - pad : pad), X2 = x + (a.flipX ? pad : W - pad);
  const Y1 = y + (a.flipY ? H - pad : pad), Y2 = y + (a.flipY ? pad : H - pad);
  switch (a.shape) {
    case 'ellipse':
      c.beginPath(); c.ellipse(x + W / 2, y + H / 2, Math.max(0, (W - sw) / 2), Math.max(0, (H - sw) / 2), 0, 0, 7);
      if (a.fill) { c.fillStyle = a.fill; c.fill(); } c.stroke(); break;
    case 'line':
      c.beginPath(); c.moveTo(X1, Y1); c.lineTo(X2, Y2); c.stroke(); break;
    case 'arrow': {
      c.beginPath(); c.moveTo(X1, Y1); c.lineTo(X2, Y2); c.stroke();
      const ang = Math.atan2(Y2 - Y1, X2 - X1), ah = Math.max(7, sw * 3.2);
      c.beginPath();
      c.moveTo(X2 - ah * Math.cos(ang - Math.PI / 6), Y2 - ah * Math.sin(ang - Math.PI / 6));
      c.lineTo(X2, Y2);
      c.lineTo(X2 - ah * Math.cos(ang + Math.PI / 6), Y2 - ah * Math.sin(ang + Math.PI / 6));
      c.stroke(); break;
    }
    case 'check':
      c.beginPath(); c.moveTo(x + W * 0.15, y + H * 0.55); c.lineTo(x + W * 0.42, y + H * 0.82); c.lineTo(x + W * 0.85, y + H * 0.2); c.stroke(); break;
    case 'x':
      c.beginPath(); c.moveTo(x + W * 0.18, y + H * 0.18); c.lineTo(x + W * 0.82, y + H * 0.82);
      c.moveTo(x + W * 0.82, y + H * 0.18); c.lineTo(x + W * 0.18, y + H * 0.82); c.stroke(); break;
    default:
      if (a.fill) { c.fillStyle = a.fill; c.fillRect(x + sw / 2, y + sw / 2, Math.max(0, W - sw), Math.max(0, H - sw)); }
      c.strokeRect(x + sw / 2, y + sw / 2, Math.max(0, W - sw), Math.max(0, H - sw));
  }
  c.restore();
}
// Draw a shape as pdf-lib vectors (non-flatten save path). H = page height (pt).
function drawShapePDF(page, a, H) {
  const col = hexToRgb(a.stroke || '#e53935');
  const stroke = rgb(col.r / 255, col.g / 255, col.b / 255);
  const sw = a.sw || 2;
  const fillC = a.fill ? (fc => rgb(fc.r / 255, fc.g / 255, fc.b / 255))(hexToRgb(a.fill)) : undefined;
  const x1 = a.x + (a.flipX ? a.w : 0), x2 = a.x + (a.flipX ? 0 : a.w);
  const y1 = a.y + (a.flipY ? a.h : 0), y2 = a.y + (a.flipY ? 0 : a.h);
  const P1 = { x: x1, y: H - y1 }, P2 = { x: x2, y: H - y2 };
  const line = (p, q) => page.drawLine({ start: p, end: q, thickness: sw, color: stroke });
  const pt = (fx, fy) => ({ x: a.x + a.w * fx, y: H - (a.y + a.h * fy) });
  switch (a.shape) {
    case 'ellipse':
      page.drawEllipse({ x: a.x + a.w / 2, y: H - (a.y + a.h / 2), xScale: a.w / 2, yScale: a.h / 2, borderColor: stroke, borderWidth: sw, color: fillC });
      break;
    case 'line': line(P1, P2); break;
    case 'arrow': {
      line(P1, P2);
      const ang = Math.atan2(P2.y - P1.y, P2.x - P1.x), ah = Math.max(7, sw * 3.2);
      line(P2, { x: P2.x - ah * Math.cos(ang - Math.PI / 6), y: P2.y - ah * Math.sin(ang - Math.PI / 6) });
      line(P2, { x: P2.x - ah * Math.cos(ang + Math.PI / 6), y: P2.y - ah * Math.sin(ang + Math.PI / 6) });
      break;
    }
    case 'check': line(pt(0.15, 0.55), pt(0.42, 0.82)); line(pt(0.42, 0.82), pt(0.85, 0.2)); break;
    case 'x': line(pt(0.18, 0.18), pt(0.82, 0.82)); line(pt(0.82, 0.18), pt(0.18, 0.82)); break;
    default:
      page.drawRectangle({ x: a.x, y: H - a.y - a.h, width: a.w, height: a.h, borderColor: stroke, borderWidth: sw, color: fillC });
  }
}
async function renderFlatPage(pn, scale) {
  const page = await pdfjsDoc.getPage(pn);
  const vp = page.getViewport({ scale });
  const cv = document.createElement('canvas');
  cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  const c = cv.getContext('2d');
  await page.render({ canvasContext: c, viewport: vp }).promise;
  for (const a of (annots[pn] || [])) {
    const x = a.x * scale, y = a.y * scale;
    if (a.type === 'wo') {
      c.fillStyle = a.fill;
      c.fillRect(x, y, a.w * scale, a.h * scale);
    } else if (a.type === 'fuzz' || a.type === 'paint') {
      let im = imgCache.get(a.id);
      if (!im || !im.complete) { try { im = await loadImg(a.img); } catch (_) { im = null; } }
      if (im) c.drawImage(im, x, y, a.w * scale, a.h * scale);
    } else if (a.type === 'shape') {
      drawShapeCanvas(c, a, scale);
    } else if (a.text && a.text.trim()) {
      const px = a.size * scale;
      c.font = (a.italic ? 'italic ' : '') + (a.bold ? '700 ' : '400 ') + px + 'px ' + FONT_CSS[a.font];
      c.textBaseline = 'alphabetic';
      const lineH = a.size * 1.2 * scale;
      a.text.split('\n').forEach((line, i) => {
        if (!line) return;
        const topY = y + i * lineH;
        if (a.bg) { c.fillStyle = a.bg; c.fillRect(x, topY, c.measureText(line).width, lineH); }
        c.fillStyle = a.color;
        c.fillText(line, x, topY + a.size * 0.92 * scale); // baseline matches the vector save path
      });
    }
  }
  return cv;
}
async function saveFlattened() {
  const doc = await PDFDocument.create();
  const SCALE = 2; // raster density for redacted output
  for (let pn = 1; pn <= pageCount; pn++) {
    $('progressLabel').textContent = 'Rasterizing page ' + pn + ' of ' + pageCount + '…';
    $('progressFill').style.width = (15 + 70 * (pn - 1) / pageCount) + '%';
    const vp1 = (await pdfjsDoc.getPage(pn)).getViewport({ scale: 1 });
    const cv = await renderFlatPage(pn, SCALE);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
    const img = await doc.embedJpg(await blob.arrayBuffer());
    const page = doc.addPage([vp1.width, vp1.height]);
    page.drawImage(img, { x: 0, y: 0, width: vp1.width, height: vp1.height });
    cv.width = cv.height = 0; // free memory
  }
  return doc.save();
}

/* ---------- save ---------- */
const _scanBtn = $('scanPiiBtn'); if (_scanBtn) _scanBtn.addEventListener('click', scanPII);
$('saveBtn').addEventListener('click', save);
async function save() {
  if (!originalBytes) return;
  const total = Object.values(annots).reduce((n, a) => n + a.length, 0);
  if (!total) return toast('Nothing to save yet — add some text or whiteout first.', 'error');
  $('progressWrap').style.display = 'block';
  $('progressFill').style.width = '15%';
  $('progressLabel').textContent = 'Applying your edits…';
  try {
    const flatten = !!($('flattenToggle') && $('flattenToggle').checked);
    let out;
    if (flatten) {
      out = await saveFlattened();
    } else {
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
        } else if (a.type === 'fuzz' || a.type === 'paint') {
          const pngBytes = await fetch(a.img).then(r => r.arrayBuffer());
          const png = await doc.embedPng(pngBytes);
          page.drawImage(png, { x: a.x, y: H - a.y - a.h, width: a.w, height: a.h });
        } else if (a.type === 'shape') {
          drawShapePDF(page, a, H);
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
    out = await doc.save();
    }
    $('progressFill').style.width = '100%';
    const blob = new Blob([out], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName.replace(/\.pdf$/i, '') + (flatten ? '-redacted.pdf' : '-edited.pdf');
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
    for (const arr of Object.values(annots)) for (const a of arr) if ((a.type === 'fuzz' || a.type === 'paint') && a.img) { const im = new Image(); im.src = a.img; imgCache.set(a.id, im); }
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
