/**
 * resume.js – handles PDF upload, progress, preview and delete
 * After successful upload → shows modal → navigates to Practice page
 */
const API = 'http://localhost:5000/api';
const token = localStorage.getItem('token');

// ── Toast helper ──────────────────────────────────────
function toast(type, message, duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  el.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── DOM refs ──────────────────────────────────────────
const fileInput = document.getElementById('resumeFileInput');
const uploadZone = document.getElementById('uploadZone');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressPct = document.getElementById('progressPct');
const progressName = document.getElementById('progressFileName');
const resumeCard = document.getElementById('resumeCard');
const resumeFileName = document.getElementById('resumeFileName');
const resumeFileMeta = document.getElementById('resumeFileMeta');
const resumeViewBtn = document.getElementById('resumeViewBtn');
const resumeDeleteBtn = document.getElementById('resumeDeleteBtn');

// ── Show / hide resume card ───────────────────────────
function showResumeCard(file) {
  if (!resumeCard) return;
  resumeCard.classList.remove('hidden');
  resumeFileName.textContent = decodeURIComponent(file.url.split('/').pop());
  resumeFileMeta.textContent = `Stored at: ${file.url}`;
  resumeViewBtn.href = file.url;
  if (uploadZone) uploadZone.style.display = 'none';
  const stat = document.getElementById('resumeStatValue');
  if (stat) stat.textContent = '✅ Yes';
}

function hideResumeCard() {
  if (!resumeCard) return;
  resumeCard.classList.add('hidden');
  if (uploadZone) uploadZone.style.display = '';
  const stat = document.getElementById('resumeStatValue');
  if (stat) stat.textContent = 'None';
}

// ── Load existing resume on page visit ───────────────
async function loadExistingResume() {
  if (!resumeCard) return;
  try {
    const res = await fetch(`${API}/resume/my-resume`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.resume) showResumeCard(data.resume);
    else hideResumeCard();
  } catch {
    hideResumeCard();
  }
}

// ── Navigate to Practice page and reset UI ───────────
function goToInterviewPage() {
  // Switch page using dashboard's showPage function
  if (typeof showPage === 'function') {
    showPage('practice');
  } else {
    const btn = document.querySelector('.nav-item[data-page="practice"]');
    if (btn) btn.click();
  }

  // Reset all interview screens - show only setup
  ['interviewLoadingScreen', 'interviewActiveScreen',
    'interviewDoneScreen', 'interviewFeedbackScreen'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
  const setup = document.getElementById('interviewSetupScreen');
  if (setup) setup.classList.remove('hidden');

  // Reset buttons to initial state
  const enableBtn = document.getElementById('enableMediaBtn');
  const startBtn = document.getElementById('startInterviewBtn');
  if (enableBtn) enableBtn.classList.remove('hidden');
  if (startBtn) startBtn.classList.add('hidden');

  toast('info', '📋 Resume ready! Click "Enable Camera & Mic" to begin your interview.');
}

// ── Show modal after upload ───────────────────────────
function showStartInterviewModal() {
  const old = document.getElementById('resumeInterviewModal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'resumeInterviewModal';
  modal.style.cssText = `
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.8);
    display: flex; align-items: center; justify-content: center;
    z-index: 99999;
  `;
  modal.innerHTML = `
    <div style="
      background: #1a1a2e;
      border: 1px solid #6c63ff;
      border-radius: 18px;
      padding: 2.5rem 2rem;
      max-width: 420px;
      width: 90%;
      text-align: center;
      color: #fff;
      box-shadow: 0 0 60px rgba(108,99,255,0.35);
    ">
      <div style="font-size:3.5rem; margin-bottom:1rem;">🎯</div>
      <h2 style="margin:0 0 0.75rem; font-size:1.4rem; font-weight:700;">Resume Uploaded!</h2>
      <p style="color:#bbb; margin-bottom:1.8rem; font-size:0.95rem; line-height:1.6;">
        AI will now generate <strong style="color:#a78bfa;">5 interview questions</strong>
        based on your resume. Ready to begin?
      </p>
      <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
        <button id="modalSkipBtn" style="
          padding:0.65rem 1.5rem; border-radius:8px;
          background:transparent; border:1px solid #444;
          color:#aaa; cursor:pointer; font-size:0.9rem;
        ">Maybe Later</button>
        <button id="modalStartBtn" style="
          padding:0.65rem 2rem; border-radius:8px;
          background:linear-gradient(135deg,#6c63ff,#a78bfa);
          border:none; color:#fff; cursor:pointer;
          font-size:1rem; font-weight:700;
        ">🚀 Start Interview</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('modalSkipBtn').addEventListener('click', () => {
    modal.remove();
  });

  document.getElementById('modalStartBtn').addEventListener('click', () => {
    modal.remove();
    goToInterviewPage();
  });
}

// ── Upload via XHR (for real progress events) ────────
function uploadFile(file) {
  if (!file) return;
  if (file.type !== 'application/pdf') {
    return toast('error', 'Only PDF files are allowed.');
  }
  if (file.size > 5 * 1024 * 1024) {
    return toast('error', 'File is too large. Maximum size is 5 MB.');
  }

  const formData = new FormData();
  formData.append('resume', file);

  const xhr = new XMLHttpRequest();

  xhr.upload.addEventListener('progress', (e) => {
    if (!e.lengthComputable) return;
    const pct = Math.round((e.loaded / e.total) * 100);
    if (uploadProgress) uploadProgress.classList.add('show');
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressPct) progressPct.textContent = `${pct}%`;
    if (progressName) progressName.textContent = file.name;
  });

  xhr.addEventListener('load', () => {
    if (uploadProgress) uploadProgress.classList.remove('show');
    if (progressFill) progressFill.style.width = '0%';

    let data;
    try { data = JSON.parse(xhr.responseText); } catch { data = {}; }

    if (xhr.status === 200 || xhr.status === 201) {
      toast('success', '✅ Resume uploaded successfully!');
      showResumeCard(data.file);
      showStartInterviewModal(); // ✨ Show modal to start interview
    } else {
      toast('error', data.message || 'Upload failed. Please try again.');
    }
  });

  xhr.addEventListener('error', () => {
    if (uploadProgress) uploadProgress.classList.remove('show');
    toast('error', 'Network error. Is the server running?');
  });

  xhr.open('POST', `${API}/resume/upload`);
  xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  xhr.send(formData);
  toast('info', `Uploading "${file.name}"…`);
}

// ── File input change ─────────────────────────────────
if (fileInput) {
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) uploadFile(fileInput.files[0]);
    fileInput.value = '';
  });
}

// ── Drag and drop ─────────────────────────────────────
if (uploadZone) {
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
  });
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  });
}

// ── Delete resume ─────────────────────────────────────
if (resumeDeleteBtn) {
  resumeDeleteBtn.addEventListener('click', async () => {
    if (!confirm('Delete your uploaded resume?')) return;
    resumeDeleteBtn.disabled = true;
    resumeDeleteBtn.textContent = 'Deleting…';
    try {
      const res = await fetch(`${API}/resume/delete`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast('success', 'Resume deleted.');
        hideResumeCard();
      } else {
        toast('error', data.message || 'Delete failed.');
      }
    } catch {
      toast('error', 'Network error.');
    } finally {
      resumeDeleteBtn.disabled = false;
      resumeDeleteBtn.textContent = 'Delete';
    }
  });
}

// ── Auto-load when Resume nav is clicked ─────────────
document.querySelectorAll('.nav-item[data-page="resume"]').forEach(btn => {
  btn.addEventListener('click', loadExistingResume);
});