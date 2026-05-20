
// shared.js - utilities used across all tool pages

// Format bytes to human readable
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(1) + ' MB';
}

// Read file as ArrayBuffer
function readAsBuffer(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = rej;
    r.readAsArrayBuffer(file);
  });
}

// Download bytes
function downloadBytes(bytes, name, mime) {
  const blob = new Blob([bytes], { type: mime || 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Show progress
function showProgress(barEl, fillEl, textEl, pct, msg) {
  if (barEl) barEl.classList.remove('hidden');
  if (fillEl) fillEl.style.width = pct + '%';
  if (textEl) textEl.textContent = msg || pct + '%';
}

// Setup drag-drop on element
function setupDrop(el, onFiles) {
  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
  el.addEventListener('drop', e => {
    e.preventDefault(); el.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  });
}

// Render file list item
function makeFileItem(file, onRemove) {
  const div = document.createElement('div');
  div.className = 'file-item';
  div.innerHTML = `<span class="file-icon">📄</span>
    <div class="file-info">
      <div class="file-name">${file.name}</div>
      <div class="file-size">${fmtSize(file.size)}</div>
    </div>
    <button class="file-remove" title="Remove">✕</button>`;
  div.querySelector('.file-remove').onclick = () => { div.remove(); onRemove(); };
  return div;
}

// Load PDF.js lazily
async function getPDFJS() {
  if (window.pdfjsLib) return window.pdfjsLib;
  return new Promise((res) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      res(pdfjsLib);
    };
    document.head.appendChild(s);
  });
}

// Load pdf-lib lazily
async function getPDFLib() {
  if (window.PDFLib) return window.PDFLib;
  return new Promise((res) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
    s.onload = () => res(window.PDFLib);
    document.head.appendChild(s);
  });
}

console.log('iLovePDF Clone - shared.js loaded');
