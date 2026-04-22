const enableMediaBtn        = document.getElementById('enableMediaBtn');
const startInterviewBtn     = document.getElementById('startInterviewBtn');
const interviewSetupScreen  = document.getElementById('interviewSetupScreen');
const interviewLoadingScreen= document.getElementById('interviewLoadingScreen');
const interviewActiveScreen = document.getElementById('interviewActiveScreen');
const interviewDoneScreen   = document.getElementById('interviewDoneScreen');
const interviewFeedbackScreen = document.getElementById('interviewFeedbackScreen');
const webcamPreview       = document.getElementById('webcamPreview');
const recordBtn           = document.getElementById('recordBtn');
const recordIcon          = document.getElementById('recordIcon');
const recordText          = document.getElementById('recordText');
const currentQNumEl       = document.getElementById('currentQNum');
const totalQNumEl         = document.getElementById('totalQNum');
const interviewQuestionText = document.getElementById('interviewQuestionText');
const interviewAnswerInput  = document.getElementById('interviewAnswerInput');
const submitAnswerBtn       = document.getElementById('submitAnswerBtn');
const finishInterviewBtn    = document.getElementById('finishInterviewBtn');

let questions    = [];
let currentIndex = 0;
let interviewId  = null;
let stream       = null;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition  = null;
let isRecording  = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous     = true;
  recognition.interimResults = true;
  recognition.lang           = 'en-US';
  recognition.onresult = (event) => {
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
    }
    if (finalTranscript) {
      interviewAnswerInput.value += (interviewAnswerInput.value ? ' ' : '') + finalTranscript;
    }
  };
  recognition.onerror = () => stopRecording();
} else {
  if (recordBtn) recordBtn.style.display = 'none';
}

function toggleRecording() { isRecording ? stopRecording() : startRecording(); }

function startRecording() {
  if (!recognition) return;
  recognition.start();
  isRecording = true;
  recordBtn.classList.add('btn-danger');
  recordBtn.classList.remove('btn-outline');
  recordIcon.textContent = '🛑';
  recordText.textContent = 'Stop Speaking';
}

function stopRecording() {
  if (!recognition) return;
  recognition.stop();
  isRecording = false;
  recordBtn.classList.remove('btn-danger');
  recordBtn.classList.add('btn-outline');
  recordIcon.textContent = '🎤';
  recordText.textContent = 'Start Speaking';
}

function speakText(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }
}

function showScreen(screenId) {
  ['interviewSetupScreen','interviewLoadingScreen','interviewActiveScreen',
   'interviewDoneScreen','interviewFeedbackScreen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  const screen = document.getElementById(screenId);
  if (screen) screen.classList.remove('hidden');
}

function showAnswerFeedback(feedback, onNext) {
  const old = document.getElementById('answerFeedbackPanel');
  if (old) old.remove();

  const score = feedback.score || 0;
  const color = score >= 7 ? '#22d3a5' : score >= 4 ? '#facc15' : '#ff6b6b';
  const emoji = score >= 7 ? '🎉' : score >= 4 ? '⚠️' : '❌';

  const panel = document.createElement('div');
  panel.id = 'answerFeedbackPanel';
  panel.style.cssText = `
    position:fixed; inset:0;
    background:rgba(0,0,0,0.85);
    display:flex; align-items:center; justify-content:center;
    z-index:99999; padding:20px;
  `;
  panel.innerHTML = `
    <div style="
      background:#0f172a;
      border:1px solid ${color};
      border-radius:18px;
      padding:2rem;
      max-width:580px;
      width:100%;
      color:#fff;
      box-shadow:0 0 40px ${color}44;
      max-height:90vh;
      overflow-y:auto;
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:2rem;">${emoji}</span>
          <div>
            <div style="font-size:1.1rem;font-weight:700;">Answer Feedback</div>
            <div style="font-size:0.8rem;color:#aaa;">Question ${currentIndex} of ${questions.length}</div>
          </div>
        </div>
        <div style="
          background:${color}22; border:2px solid ${color};
          border-radius:50%; width:56px; height:56px;
          display:flex; align-items:center; justify-content:center;
          font-size:1.3rem; font-weight:800; color:${color};
        ">${score}/10</div>
      </div>

      ${feedback.mistakes && feedback.mistakes !== 'None' ? `
      <div style="background:rgba(255,107,107,0.08);border:1px solid rgba(255,107,107,0.3);border-radius:10px;padding:1rem 1.2rem;margin-bottom:1rem;">
        <div style="font-weight:700;color:#ff6b6b;margin-bottom:6px;">⚠️ Mistakes / Gaps</div>
        <div style="color:#fca5a5;font-size:0.92rem;line-height:1.6;">${feedback.mistakes}</div>
      </div>` : `
      <div style="background:rgba(34,211,165,0.08);border:1px solid rgba(34,211,165,0.3);border-radius:10px;padding:0.8rem 1.2rem;margin-bottom:1rem;">
        <div style="color:#22d3a5;font-weight:600;">✅ Great answer! No major mistakes found.</div>
      </div>`}

      <div style="background:rgba(108,99,255,0.08);border:1px solid rgba(108,99,255,0.3);border-radius:10px;padding:1rem 1.2rem;margin-bottom:1rem;">
        <div style="font-weight:700;color:#a78bfa;margin-bottom:6px;">💡 Ideal Answer</div>
        <div style="color:#c4b5fd;font-size:0.92rem;line-height:1.6;">${feedback.correct_answer}</div>
      </div>

      <div style="background:rgba(250,204,21,0.08);border:1px solid rgba(250,204,21,0.25);border-radius:10px;padding:0.8rem 1.2rem;margin-bottom:1.5rem;">
        <div style="font-weight:700;color:#facc15;margin-bottom:4px;">🎯 Pro Tip</div>
        <div style="color:#fde68a;font-size:0.9rem;line-height:1.5;">${feedback.tip}</div>
      </div>

      <button id="feedbackNextBtn" style="
        width:100%; padding:0.85rem; border-radius:10px;
        background:linear-gradient(135deg,#6c63ff,#a78bfa);
        border:none; color:#fff; font-size:1rem; font-weight:700; cursor:pointer;
      ">${currentIndex >= questions.length ? '📊 View Final Report' : '➡️ Next Question'}</button>
    </div>
  `;

  document.body.appendChild(panel);
  document.getElementById('feedbackNextBtn').addEventListener('click', () => {
    panel.remove();
    onNext();
  });
}

async function enableMedia() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    webcamPreview.srcObject = stream;
    enableMediaBtn.classList.add('hidden');
    startInterviewBtn.classList.remove('hidden');
  } catch (err) {
    alert("Camera/Microphone permission denied. You can still type your answers.");
    enableMediaBtn.classList.add('hidden');
    startInterviewBtn.classList.remove('hidden');
  }
}

async function startInterview() {
  showScreen('interviewLoadingScreen');
  try {
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:5000/api/interview/generate', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok) {
      questions    = data.questions;
      interviewId  = data.interviewId;
      currentIndex = 0;
      totalQNumEl.textContent = questions.length;
      loadQuestion();
      showScreen('interviewActiveScreen');
    } else {
      showScreen('interviewSetupScreen');
      alert(`Error: ${data.message}`);
    }
  } catch (err) {
    showScreen('interviewSetupScreen');
    alert('Network error while starting interview.');
  }
}

function loadQuestion() {
  if (currentIndex >= questions.length) {
    if (isRecording) stopRecording();
    fetchFinalFeedback();
    return;
  }
  if (isRecording) stopRecording();
  currentQNumEl.textContent = currentIndex + 1;
  const qText = questions[currentIndex].question_text;
  interviewQuestionText.textContent = qText;
  interviewAnswerInput.value = '';
  submitAnswerBtn.textContent = currentIndex === questions.length - 1 ? 'Submit & Finish' : 'Submit & Next';
  speakText(qText);
}

async function submitAnswer() {
  const answer = interviewAnswerInput.value.trim();
  if (!answer) {
    alert('Please type or speak an answer before proceeding.');
    return;
  }
  const questionId = questions[currentIndex].id;
  submitAnswerBtn.disabled    = true;
  submitAnswerBtn.textContent = 'Analyzing…';

  try {
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:5000/api/interview/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ questionId, answer })
    });
    const data = await res.json();
    if (res.ok) {
      currentIndex++;
      if (data.feedback) {
        showAnswerFeedback(data.feedback, () => loadQuestion());
      } else {
        loadQuestion();
      }
    } else {
      alert(`Error saving answer: ${data.message}`);
    }
  } catch (err) {
    alert('Network error while saving answer.');
  } finally {
    submitAnswerBtn.disabled = false;
    submitAnswerBtn.textContent = currentIndex >= questions.length ? 'Submit & Finish' : 'Submit & Next';
  }
}

async function fetchFinalFeedback() {
  showScreen('interviewDoneScreen');
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`http://localhost:5000/api/interview/${interviewId}/feedback`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok) {
      const fb = data.feedback;
      document.getElementById('fbOverall').textContent     = fb.overall_score    || 0;
      document.getElementById('fbComm').textContent        = fb.communication    || 0;
      document.getElementById('fbTech').textContent        = fb.technical        || 0;
      document.getElementById('fbSummary').textContent     = fb.feedback_summary || '';
      document.getElementById('fbSuggestions').textContent = fb.suggestions      || '';
      showScreen('interviewFeedbackScreen');
    } else {
      alert(`Failed to analyze: ${data.message}`);
      showScreen('interviewSetupScreen');
    }
  } catch (err) {
    alert('Network error while fetching feedback.');
    showScreen('interviewSetupScreen');
  }
}

function cleanupMedia() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (isRecording) stopRecording();
}

const termsModal    = document.getElementById('termsModal');
const termsCheckbox = document.getElementById('termsCheckbox');
const cancelTermsBtn= document.getElementById('cancelTermsBtn');
const acceptTermsBtn= document.getElementById('acceptTermsBtn');

if (enableMediaBtn) {
  enableMediaBtn.addEventListener('click', () => {
    if (termsModal) termsModal.classList.remove('hidden');
  });
}
if (termsCheckbox && acceptTermsBtn) {
  termsCheckbox.addEventListener('change', (e) => {
    acceptTermsBtn.disabled = !e.target.checked;
  });
}
if (cancelTermsBtn && termsModal) {
  cancelTermsBtn.addEventListener('click', () => {
    termsModal.classList.add('hidden');
    if (termsCheckbox) termsCheckbox.checked = false;
    if (acceptTermsBtn) acceptTermsBtn.disabled = true;
  });
}
if (acceptTermsBtn && termsModal) {
  acceptTermsBtn.addEventListener('click', () => {
    termsModal.classList.add('hidden');
    enableMedia();
  });
}

if (startInterviewBtn) startInterviewBtn.addEventListener('click', startInterview);
if (recordBtn)         recordBtn.addEventListener('click', toggleRecording);
if (submitAnswerBtn)   submitAnswerBtn.addEventListener('click', submitAnswer);
if (finishInterviewBtn) {
  finishInterviewBtn.addEventListener('click', () => {
    cleanupMedia();
    document.querySelector('.nav-item[data-page="overview"]')?.click();
    enableMediaBtn.classList.remove('hidden');
    startInterviewBtn.classList.add('hidden');
    showScreen('interviewSetupScreen');
  });
}
