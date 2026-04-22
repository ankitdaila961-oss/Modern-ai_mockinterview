/**
 * auth.js – Register & Login with full client-side validation + JWT storage
 */

const API = '/api';  // ✅ FIXED — was API_BASE, now API (matches all fetch calls)

const isRegisterPage = !!document.getElementById('registerForm');
const isLoginPage = !!document.getElementById('loginForm');

// ── Redirect already-logged-in users to dashboard ─────
if (localStorage.getItem('token')) {
  window.location.href = 'dashboard.html';
}

// ── Helpers ───────────────────────────────────────────
function showAlert(type, message) {
  const err = document.getElementById('alertError');
  const succ = document.getElementById('alertSuccess');

  if (!err || !succ) return;

  err.classList.remove('show');
  succ.classList.remove('show');

  if (type === 'error') {
    document.getElementById('alertErrorMsg').textContent = message;
    err.classList.add('show');
    setTimeout(() => err.classList.remove('show'), 6000);
  } else {
    document.getElementById('alertSuccessMsg').textContent = message;
    succ.classList.add('show');
  }
}

function setLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `<span class="spinner"></span> Please wait…`
    : label;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function markField(id, valid) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('error', !valid);
  el.classList.toggle('valid', valid);
}

// ── Password strength (register page only) ────────────
function getStrength(pw) {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

// ── Register ──────────────────────────────────────────
if (isRegisterPage) {
  const pwInput = document.getElementById('password');
  const bar = document.getElementById('strengthBar');
  const barFill = document.getElementById('strengthFill');
  const barText = document.getElementById('strengthText');

  if (pwInput && bar) {
    pwInput.addEventListener('input', () => {
      const val = pwInput.value;
      const s = getStrength(val);

      bar.style.display = val ? 'block' : 'none';

      const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
      const colors = ['', '#ff6b6b', '#fbbf24', '#60a5fa', '#34d399', '#22d3a5'];

      barFill.style.width = `${(s / 5) * 100}%`;
      barFill.style.background = colors[s] || '#ff6b6b';
      barText.textContent = labels[s] || '';
      barText.style.color = colors[s] || '#ff6b6b';
    });
  }

  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirm = document.getElementById('confirmPassword').value;
      const btn = document.getElementById('submitBtn');

      // ── Validation ──
      let valid = true;

      if (!name) {
        markField('name', false); valid = false;
      } else {
        markField('name', true);
      }

      if (!isValidEmail(email)) {
        markField('email', false); valid = false;
      } else {
        markField('email', true);
      }

      if (password.length < 6) {
        markField('password', false); valid = false;
      } else {
        markField('password', true);
      }

      if (password !== confirm) {
        markField('confirmPassword', false); valid = false;
      } else {
        markField('confirmPassword', true);
      }

      if (!valid) {
        return showAlert('error', 'Please fix the highlighted fields.');
      }

      // ── API Call ──
      setLoading(btn, true, 'Create Account');
      try {
        const res = await fetch(`${API}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          setLoading(btn, false, 'Create Account');
          return showAlert('error', data.message || 'Registration failed.');
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        showAlert('success', '✅ Account created! Redirecting to dashboard…');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);

      } catch (err) {
        console.error('[register]', err);
        setLoading(btn, false, 'Create Account');
        showAlert('error', 'Cannot connect to server. Make sure the server is running.');
      }
    });
  }
}

// ── Login ─────────────────────────────────────────────
if (isLoginPage) {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const btn = document.getElementById('submitBtn');

      // ── Validation ──
      let valid = true;

      if (!isValidEmail(email)) {
        markField('email', false); valid = false;
      } else {
        markField('email', true);
      }

      if (!password) {
        markField('password', false); valid = false;
      } else {
        markField('password', true);
      }

      if (!valid) {
        return showAlert('error', 'Please enter a valid email and password.');
      }

      // ── API Call ──
      setLoading(btn, true, 'Sign In');
      try {
        const res = await fetch(`${API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          setLoading(btn, false, 'Sign In');
          return showAlert('error', data.message || 'Login failed. Check your credentials.');
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        showAlert('success', '✅ Login successful! Redirecting…');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);

      } catch (err) {
        console.error('[login]', err);
        setLoading(btn, false, 'Sign In');
        showAlert('error', 'Cannot connect to server. Make sure the server is running.');
      }
    });
  }
}