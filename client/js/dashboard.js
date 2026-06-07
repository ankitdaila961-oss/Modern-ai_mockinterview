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
  btn.addEventListener('click', () => {
    showPage(btn.dataset.page);
    if (btn.dataset.page === 'overview') {
      fetchAnalytics();
    } else if (btn.dataset.page === 'history') {
      fetchHistory();
    }
  });
});

async function fetchHistory() {
  const container = document.getElementById('historyContainer');
  if (!container) return;

  try {
    const res = await fetch(`${API}/interview/history`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    if (res.ok && data.history && data.history.length > 0) {
      container.innerHTML = '';
      data.history.forEach(item => {
        const dateStr = new Date(item.created_at).toLocaleString();
        const scoreColor = item.score >= 7 ? 'var(--success)' : (item.score >= 4 ? 'var(--warning)' : 'var(--danger)');
        
        const card = document.createElement('div');
        card.className = 'glass-panel';
        card.style.cssText = 'padding: 20px; text-align: left;';
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
            <span style="color: var(--text-muted); font-size: 0.9rem;">${dateStr}</span>
            <span style="font-weight: bold; color: ${scoreColor}; font-size: 1.1rem;">Score: ${item.score || 0}/10</span>
          </div>
          <div style="margin-bottom: 15px;">
            <strong style="color: var(--accent-2);">Q:</strong> ${item.question}
          </div>
          <div style="margin-bottom: 15px; font-size: 0.95rem; color: var(--text-secondary);">
            <strong>Your Answer:</strong><br/>
            ${item.answer || '(No answer provided)'}
          </div>
          <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: var(--radius); border-left: 4px solid ${scoreColor};">
            <strong style="color: ${scoreColor};">Feedback:</strong><br/>
            <span style="color: var(--text-secondary); line-height: 1.5;">${item.feedback}</span>
          </div>
        `;
        container.appendChild(card);
      });
    } else {
      container.innerHTML = `
        <div class="glass-panel" style="padding:40px; text-align:center; color:var(--text-muted);">
          No history available yet.
        </div>
      `;
    }
  } catch (err) {
    container.innerHTML = `
      <div class="glass-panel" style="padding:40px; text-align:center; color:var(--danger);">
        Failed to load history.
      </div>
    `;
    console.error('Failed to fetch history:', err);
  }
}

// ── Logout ────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
});

// ── Quick Practice Flow ───────────────────────────────
const quickStartBtn = document.getElementById('quickStartBtn');
const quickSetup = document.getElementById('quickSetup');
const quickActive = document.getElementById('quickActive');
const quickQuestionDisplay = document.getElementById('quickQuestionDisplay');
const quickAnswerInput = document.getElementById('quickAnswerInput');
const quickSubmitBtn = document.getElementById('quickSubmitBtn');
const quickResult = document.getElementById('quickResult');
const quickScore = document.getElementById('quickScore');
const quickFeedbackText = document.getElementById('quickFeedbackText');
const quickRetryBtn = document.getElementById('quickRetryBtn');

let currentQuickQuestion = '';

if (quickStartBtn) {
  quickStartBtn.addEventListener('click', async () => {
    quickSetup.classList.add('hidden');
    quickActive.classList.remove('hidden');
    quickResult.classList.add('hidden');
    quickQuestionDisplay.textContent = 'Generating question...';
    quickAnswerInput.value = '';
    quickSubmitBtn.disabled = false;

    try {
      const roleInput = document.getElementById('profileRole');
      const role = (roleInput && roleInput.value) ? roleInput.value : 'Software Engineer';
      const difficulty = 'medium';
      
      const res = await fetch(`${API}/interview/question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ job_role: role, difficulty })
      });
      const data = await res.json();
      if (res.ok) {
        currentQuickQuestion = data.question;
        quickQuestionDisplay.textContent = currentQuickQuestion;
      } else {
        quickQuestionDisplay.textContent = 'Error: ' + data.message;
      }
    } catch (e) {
      quickQuestionDisplay.textContent = 'Failed to load question. Check console for details.';
      console.error(e);
    }
  });
}

if (quickSubmitBtn) {
  quickSubmitBtn.addEventListener('click', async () => {
    const answer = quickAnswerInput.value.trim();
    if (!answer) return alert('Please enter an answer.');

    quickSubmitBtn.disabled = true;
    quickSubmitBtn.textContent = 'Evaluating...';

    try {
      const res = await fetch(`${API}/interview/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ question: currentQuickQuestion, user_answer: answer })
      });
      const data = await res.json();
      if (res.ok) {
        quickActive.classList.add('hidden');
        quickResult.classList.remove('hidden');
        quickScore.textContent = data.score;
        quickFeedbackText.textContent = data.feedback;
      } else {
        alert('Error: ' + data.message);
      }
    } catch (e) {
      alert('Failed to evaluate answer. Check console for details.');
      console.error(e);
    } finally {
      quickSubmitBtn.textContent = 'Submit Answer';
    }
  });
}

if (quickRetryBtn) {
  quickRetryBtn.addEventListener('click', () => {
    quickResult.classList.add('hidden');
    quickSetup.classList.remove('hidden');
  });
}

// ── Analytics & Chart.js Integration ──────────────────
let progressChartInstance = null;
let radarChartInstance = null;

function renderCharts(weeklyData, skillScores) {
  if (progressChartInstance) progressChartInstance.destroy();
  if (radarChartInstance) radarChartInstance.destroy();

  // 1. Line Chart
  const progressCtx = document.getElementById('progressChart').getContext('2d');
  const progressGradient = progressCtx.createLinearGradient(0, 0, 0, 240);
  progressGradient.addColorStop(0, 'rgba(108, 99, 255, 0.35)');
  progressGradient.addColorStop(1, 'rgba(108, 99, 255, 0.01)');

  progressChartInstance = new Chart(progressCtx, {
    type: 'line',
    data: {
      labels: weeklyData.map(d => d.date),
      datasets: [{
        label: 'Overall Performance',
        data: weeklyData.map(d => d.score),
        borderColor: '#6c63ff',
        borderWidth: 3,
        backgroundColor: progressGradient,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#a78bfa',
        pointBorderColor: '#0d0f1a',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#12152b',
          titleColor: '#f1f1f5',
          bodyColor: '#9ca3c4',
          borderColor: 'rgba(108, 99, 255, 0.3)',
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return `Score: ${context.parsed.y}%`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false },
          ticks: { color: '#9ca3c4', font: { family: 'Inter', size: 10 } }
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false },
          ticks: { 
            color: '#9ca3c4', 
            font: { family: 'Inter', size: 10 },
            stepSize: 20,
            callback: function(val) { return val + '%'; }
          }
        }
      }
    }
  });

  // 2. Radar Chart
  const radarCtx = document.getElementById('radarChart').getContext('2d');
  radarChartInstance = new Chart(radarCtx, {
    type: 'radar',
    data: {
      labels: ['Overall', 'Communication', 'Technical', 'Confidence'],
      datasets: [{
        label: 'Metrics',
        data: [
          skillScores.overall,
          skillScores.communication,
          skillScores.technical,
          skillScores.confidence
        ],
        backgroundColor: 'rgba(34, 211, 165, 0.15)',
        borderColor: '#22d3a5',
        borderWidth: 2,
        pointBackgroundColor: '#22d3a5',
        pointBorderColor: '#0d0f1a',
        pointBorderWidth: 1.5,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#12152b',
          titleColor: '#f1f1f5',
          bodyColor: '#9ca3c4',
          borderColor: 'rgba(34, 211, 165, 0.3)',
          borderWidth: 1,
          padding: 8,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return `${context.label}: ${context.parsed.r}%`;
            }
          }
        }
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          angleLines: { color: 'rgba(255, 255, 255, 0.05)' },
          pointLabels: {
            color: '#9ca3c4',
            font: { family: 'Inter', size: 10, weight: '500' }
          },
          ticks: {
            display: false,
            stepSize: 25
          }
        }
      }
    }
  });
}

async function fetchAnalytics() {
  try {
    const res = await fetch(`${API}/user/analytics`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    let data = await res.json();
    
    // Fallback to beautiful mock/demo data if user has no sessions yet
    if (!res.ok || !data.hasData) {
      document.getElementById('demoBadge')?.classList.remove('hidden');
      data = {
        summary: {
          sessionsCount: 0,
          avgOverallScore: 76,
          avgCommunicationScore: 80,
          avgTechnicalScore: 72,
          avgConfidenceScore: 78,
          streak: 2
        },
        weeklyProgress: [
          { date: 'May 28', score: 60 },
          { date: 'May 30', score: 65 },
          { date: 'Jun 01', score: 70 },
          { date: 'Jun 03', score: 74 },
          { date: 'Jun 05', score: 76 }
        ],
        recentActivity: [
          { type: 'Mock Session', score: 76, created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
          { type: 'Quick Practice', score: 80, created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() },
          { type: 'Quick Practice', score: 70, created_at: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString() }
        ]
      };
    } else {
      document.getElementById('demoBadge')?.classList.add('hidden');
    }

    // Populate overall metrics values and animate progress bars
    const sum = data.summary;
    document.getElementById('statOverallScore').textContent = sum.avgOverallScore + '%';
    document.getElementById('statCommScore').textContent = sum.avgCommunicationScore + '%';
    document.getElementById('statTechScore').textContent = sum.avgTechnicalScore + '%';
    document.getElementById('statConfScore').textContent = sum.avgConfidenceScore + '%';
    document.getElementById('statStreak').textContent = sum.streak;
    document.getElementById('statStreakDays').textContent = sum.streak + (sum.streak === 1 ? ' day' : ' days');

    setTimeout(() => {
      const ob = document.getElementById('statOverallBar');
      if (ob) ob.style.width = sum.avgOverallScore + '%';
      const cb = document.getElementById('statCommBar');
      if (cb) cb.style.width = sum.avgCommunicationScore + '%';
      const tb = document.getElementById('statTechBar');
      if (tb) tb.style.width = sum.avgTechnicalScore + '%';
      const cfb = document.getElementById('statConfBar');
      if (cfb) cfb.style.width = sum.avgConfidenceScore + '%';
    }, 100);

    // Render Progress and Radar Skill Charts
    renderCharts(data.weeklyProgress, {
      overall: sum.avgOverallScore,
      communication: sum.avgCommunicationScore,
      technical: sum.avgTechnicalScore,
      confidence: sum.avgConfidenceScore
    });

    // Populate Recent Activity list
    const listContainer = document.getElementById('recentActivityList');
    if (listContainer) {
      if (data.recentActivity && data.recentActivity.length > 0) {
        listContainer.innerHTML = '';
        data.recentActivity.forEach(s => {
          const dateStr = new Date(s.created_at).toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          const scoreColor = s.score >= 70 ? 'var(--success)' : (s.score >= 40 ? 'var(--warning)' : 'var(--danger)');
          
          const card = document.createElement('div');
          card.className = 'glass-panel';
          card.style.cssText = 'padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.01); border: 1px solid var(--border); border-radius: var(--radius-sm); transition: var(--transition); cursor: pointer;';
          card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(108, 99, 255, 0.12); display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
                ${s.type === 'Quick Practice' ? '⚡' : '🎤'}
              </div>
              <div>
                <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">${s.type}</div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">${dateStr}</div>
              </div>
            </div>
            <div style="font-size: 1rem; font-weight: 700; color: ${scoreColor};">${s.score}%</div>
          `;
          card.addEventListener('click', () => showPage('history'));
          listContainer.appendChild(card);
        });
      } else {
        listContainer.innerHTML = `
          <div class="empty-state" style="padding: 30px;">
            <div class="empty-state-icon" style="font-size: 2rem; margin-bottom: 10px;">🎯</div>
            <h3>No sessions yet</h3>
            <p style="font-size: 0.85rem;">Start your first mock interview to view analytics here.</p>
          </div>
        `;
      }
    }
  } catch (err) {
    console.error('Failed to fetch analytics:', err);
  }
}

// Initial fetch on page load
fetchAnalytics();
