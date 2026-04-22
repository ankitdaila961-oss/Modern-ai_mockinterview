/**
 * dashboard.js – loads user data and handles sidebar navigation
 */
const API = 'http://localhost:5000/api';

// ── Guard: redirect if not logged in ──────────────────
const token = localStorage.getItem('token');
const user  = JSON.parse(localStorage.getItem('user') || 'null');
if (!token || !user) {
  window.location.href = 'login.html';
}

// ── Populate user info ────────────────────────────────
function getInitials(name) {
  return name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
}

function populateUser(u) {
  const initials = getInitials(u.name);
  // Sidebar
  document.getElementById('sidebarName').textContent  = u.name  || 'User';
  document.getElementById('sidebarEmail').textContent = u.email || '';
  document.getElementById('sidebarAvatar').textContent = initials;
  // Greeting
  document.getElementById('greetingName').textContent = u.name?.split(' ')[0] || 'there';
  // Profile page
  document.getElementById('profileAvatar').textContent    = initials;
  document.getElementById('profileName').textContent      = u.name  || '—';
  document.getElementById('profileEmail').textContent     = u.email || '—';
  document.getElementById('profileNameInput').value       = u.name  || '';
  document.getElementById('profileEmailInput').value      = u.email || '';
}

populateUser(user);

// Optionally refresh from server
async function fetchProfile() {
  try {
    const res = await fetch(`${API}/user/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('user', JSON.stringify(data.user));
      populateUser(data.user);
    }
  } catch { /* server might be offline */ }
}
fetchProfile();

// ── Page Navigation ───────────────────────────────────
const pages   = document.querySelectorAll('[id^="page-"]');
const navItems = document.querySelectorAll('.nav-item[data-page]');

function showPage(name) {
  pages.forEach(p => p.classList.toggle('hidden', p.id !== `page-${name}`));
  navItems.forEach(n => n.classList.toggle('active', n.dataset.page === name));
}

navItems.forEach(btn => {
  btn.addEventListener('click', () => showPage(btn.dataset.page));
});

// ── Logout ────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
});
