/* EvrythingPDF - Core Application JavaScript */
'use strict';

// ===== MOBILE MENU =====
function toggleMenu() {
  const menu = document.getElementById('mobileMenu');
  if (menu) menu.classList.toggle('open');
}

// ===== DRAG & DROP =====
function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}
function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}
function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const files = e.dataTransfer.files;
  if (files.length) routeFile(files[0]);
}
function triggerUpload() {
  const input = document.getElementById('mainFileInput');
  if (input) input.click();
}
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) routeFile(file);
}
function routeFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const routes = {
    pdf: 'viewer.html',
    docx: 'word-to-pdf.html',
    doc: 'word-to-pdf.html',
    png: 'jpg-to-pdf.html',
    jpg: 'jpg-to-pdf.html',
    jpeg: 'jpg-to-pdf.html'
  };
  const page = routes[ext] || 'viewer.html';
  // Store file for the tool page
  sessionStorage.setItem('pendingFile', JSON.stringify({name: file.name, size: file.size, type: file.type}));
  window.location.href = page + '?file=' + encodeURIComponent(file.name);
}

// ===== FAQ ACCORDION =====
function toggleFaq(btn) {
  const answer = btn.nextElementSibling;
  const isOpen = answer.classList.contains('open');
  // Close all
  document.querySelectorAll('.faq-a').forEach(a => a.classList.remove('open'));
  document.querySelectorAll('.faq-q').forEach(q => q.classList.remove('open'));
  if (!isOpen) {
    answer.classList.add('open');
    btn.classList.add('open');
  }
}

// ===== TOAST NOTIFICATIONS =====
function showToast(msg, type = '') {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'toast ' + type;
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// ===== TOOL PAGE - DROP ZONE =====
function initDropZone(zoneId, inputId, onFile) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFile(files);
  });
  zone.addEventListener('click', () => input && input.click());
  if (input) input.addEventListener('change', e => {
    const files = Array.from(e.target.files);
    if (files.length) onFile(files);
  });
}

// ===== FORMAT FILE SIZE =====
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(2) + ' MB';
}

// ===== ADD FILE TO LIST =====
function addFileToList(containerId, file, onRemove) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.style.display = 'flex';
  const item = document.createElement('div');
  item.className = 'file-item';
  item.innerHTML = `
    <span class="file-item-icon">📄</span>
    <span class="file-item-name">${escapeHtml(file.name)}</span>
    <span class="file-item-size">${formatSize(file.size)}</span>
    <button class="file-item-remove" title="Remove" onclick="this.closest('.file-item').remove(); checkEmpty('${containerId}')">✕</button>
  `;
  item._file = file;
  container.appendChild(item);
}
function checkEmpty(id) {
  const el = document.getElementById(id);
  if (el && el.children.length === 0) el.style.display = 'none';
}
function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== SIMULATE PROGRESS =====
function simulateProgress(fillId, labelId, duration, onComplete) {
  const fill = document.getElementById(fillId);
  const label = document.getElementById(labelId);
  const wrapper = fill?.closest('.progress-wrapper');
  if (!fill) return;
  if (wrapper) wrapper.style.display = 'block';
  let pct = 0;
  const step = 100 / (duration / 80);
  const interval = setInterval(() => {
    pct = Math.min(pct + step + Math.random() * step * 0.5, 95);
    fill.style.width = pct + '%';
    if (label) label.textContent = Math.round(pct) + '% processed...';
    if (pct >= 95) {
      clearInterval(interval);
      setTimeout(() => {
        fill.style.width = '100%';
        if (label) label.textContent = 'Complete!';
        if (onComplete) onComplete();
      }, 400);
    }
  }, 80);
}

// ===== SHOW RESULT =====
function showResult(boxId, filename) {
  const box = document.getElementById(boxId);
  if (!box) return;
  box.style.display = 'block';
  const dlBtn = box.querySelector('.btn-primary');
  if (dlBtn) dlBtn.setAttribute('data-filename', filename);
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ===== SMOOTH SCROLL NAV =====
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
  });
});

// ===== AdSense helper =====
window.adsbygoogle = window.adsbygoogle || [];
