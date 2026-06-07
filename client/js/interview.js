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

let faceApiLoaded = false;
let confidenceInterval = null;
let confidenceScores = [];
let eyeContactFrames = 0;
let totalFrames = 0;

const faceCanvas = document.getElementById('faceCanvas');
const confidenceDisplay = document.getElementById('confidenceDisplay');
const confScoreText = document.getElementById('confScoreText');
const confEmotionText = document.getElementById('confEmotionText');
const confEyeText = document.getElementById('confEyeText');

async function loadFaceApiModels() {
  try {
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
    ]);
    faceApiLoaded = true;
    console.log('Face API models loaded');
  } catch (err) {
    console.error('Error loading face-api models', err);
  }
}
loadFaceApiModels();

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition  = null;
let isRecording  = false;
let recordingStartTime = null;
let recordingTotalTime = 0;

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
  recordingStartTime = Date.now();
  recognition.start();
  isRecording = true;
  recordBtn.classList.add('btn-danger');
  recordBtn.classList.remove('btn-outline');
  recordIcon.textContent = '🛑';
  recordText.textContent = 'Stop Speaking';
}

function stopRecording() {
  if (!recognition) return;
  if (recordingStartTime) {
    recordingTotalTime += Date.now() - recordingStartTime;
    recordingStartTime = null;
  }
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

function showAnswerFeedback(feedback, onNext, stats) {
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

      ${stats ? `
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:1rem 1.2rem;margin-bottom:1rem;">
        <div style="font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:8px;">🎤 Speech Analysis</div>
        
        <div style="display:flex;gap:20px;margin-bottom:12px;">
          <div style="flex:1;background:rgba(0,0,0,0.2);padding:10px;border-radius:8px;text-align:center;">
            <div style="font-size:1.5rem;font-weight:bold;color:${stats.fillerCount > 3 ? '#ff6b6b' : '#22d3a5'};">${stats.fillerCount}</div>
            <div style="font-size:0.8rem;color:#aaa;">Filler Words</div>
          </div>
          <div style="flex:1;background:rgba(0,0,0,0.2);padding:10px;border-radius:8px;text-align:center;">
            <div style="font-size:1.5rem;font-weight:bold;color:${stats.speedColor};">${stats.speedRating}</div>
            <div style="font-size:0.8rem;color:#aaa;">Pace (${stats.wpm > 0 ? stats.wpm + ' wpm' : '--'})</div>
          </div>
        </div>

        <div style="font-size:0.9rem;line-height:1.6;color:#ccc;background:rgba(0,0,0,0.2);padding:10px;border-radius:8px;">
          <span style="color:#fff;font-weight:bold;">Transcript:</span><br/>
          ${stats.highlightedTranscript || '(No speech recorded)'}
        </div>
      </div>
      ` : ''}

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
    webcamPreview.onloadedmetadata = () => {
      webcamPreview.play();
    };
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
  
  // reset stats
  confidenceScores = [];
  eyeContactFrames = 0;
  totalFrames = 0;

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
      startFaceTracking();
    } else {
      showScreen('interviewSetupScreen');
      alert(`Error: ${data.message}`);
    }
  } catch (err) {
    showScreen('interviewSetupScreen');
    alert('Network error while starting interview.');
  }
}

async function startFaceTracking() {
  if (!faceApiLoaded || !webcamPreview) return;
  confidenceDisplay.style.display = 'block';
  
  if (faceCanvas) {
    faceapi.matchDimensions(faceCanvas, webcamPreview);
  }

  confidenceInterval = setInterval(async () => {
    if (webcamPreview.paused || webcamPreview.ended || webcamPreview.readyState < 2) return;
    
    try {
      const detections = await faceapi.detectAllFaces(webcamPreview, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();
        
      if (faceCanvas) {
        const resizedDetections = faceapi.resizeResults(detections, webcamPreview);
        faceCanvas.getContext('2d').clearRect(0, 0, faceCanvas.width, faceCanvas.height);
        faceapi.draw.drawDetections(faceCanvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(faceCanvas, resizedDetections);
      }
      
      totalFrames++;
      if (detections.length > 0) {
        const det = detections[0];
        const expressions = det.expressions;
        let dominantEmotion = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);
        
        const landmarks = det.landmarks;
        const nose = landmarks.getNose()[0];
        const leftEye = landmarks.getLeftEye()[0];
        const rightEye = landmarks.getRightEye()[0];
        const eyeCenter = (leftEye.x + rightEye.x) / 2;
        const diff = Math.abs(nose.x - eyeCenter);
        const faceWidth = Math.abs(landmarks.getPositions()[16].x - landmarks.getPositions()[0].x);
        
        let isLookingAtCamera = (diff / faceWidth) < 0.15;
        if (isLookingAtCamera) eyeContactFrames++;
        
        let confScore = 50; 
        if (dominantEmotion === 'happy') confScore = 90;
        else if (dominantEmotion === 'neutral') confScore = 75;
        else if (['sad', 'fear', 'angry', 'disgusted'].includes(dominantEmotion)) confScore = 30;
        else if (dominantEmotion === 'surprised') confScore = 60;
        
        if (isLookingAtCamera) confScore += 10;
        else confScore -= 20;
        
        confScore = Math.max(0, Math.min(100, confScore));
        confidenceScores.push(confScore);
        
        confScoreText.textContent = `Confidence: ${Math.round(confScore)}%`;
        confScoreText.style.color = confScore >= 70 ? '#22d3a5' : (confScore >= 40 ? '#facc15' : '#ff6b6b');
        confEmotionText.textContent = `Emotion: ${dominantEmotion}`;
        confEyeText.textContent = `Eye Contact: ${isLookingAtCamera ? 'Good' : 'Poor'}`;
      } else {
        confScoreText.textContent = `Confidence: 0%`;
        confScoreText.style.color = '#ff6b6b';
        confEmotionText.textContent = `Emotion: None`;
        confEyeText.textContent = `Eye Contact: No Face`;
        confidenceScores.push(0);
      }
    } catch(e) { console.error(e); }
  }, 500);
}

function stopFaceTracking() {
  if (confidenceInterval) clearInterval(confidenceInterval);
  if (confidenceDisplay) confidenceDisplay.style.display = 'none';
  if (faceCanvas) {
    faceCanvas.getContext('2d').clearRect(0, 0, faceCanvas.width, faceCanvas.height);
  }
}

function loadQuestion() {
  recordingTotalTime = 0;
  recordingStartTime = null;
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
  if (isRecording) stopRecording();
  
  const answer = interviewAnswerInput.value.trim();
  if (!answer) {
    alert('Please type or speak an answer before proceeding.');
    return;
  }
  
  const words = answer.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  const fillersToMatch = ['um', 'uh', 'like', 'you know', 'literally', 'basically', 'actually'];
  let highlightedTranscript = answer;
  let fillerCount = 0;

  fillersToMatch.forEach(filler => {
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    const matches = highlightedTranscript.match(regex);
    if (matches) {
      fillerCount += matches.length;
      highlightedTranscript = highlightedTranscript.replace(regex, `<span style="background:rgba(255,107,107,0.3); color:#ff6b6b; padding:0 4px; border-radius:4px;">$&</span>`);
    }
  });

  let wpm = 0;
  let speedRating = "N/A";
  let speedColor = "#ccc";

  if (recordingTotalTime > 3000) {
    const minutes = recordingTotalTime / 60000;
    wpm = Math.round(wordCount / minutes);
    if (wpm < 110) {
      speedRating = "Slow";
      speedColor = "#facc15";
    } else if (wpm > 160) {
      speedRating = "Fast";
      speedColor = "#ff6b6b";
    } else {
      speedRating = "Normal";
      speedColor = "#22d3a5";
    }
  }

  const speechStats = {
    fillerCount,
    highlightedTranscript,
    wpm,
    speedRating,
    speedColor
  };

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
        showAnswerFeedback(data.feedback, () => loadQuestion(), speechStats);
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
  stopFaceTracking();
  showScreen('interviewDoneScreen');

  let avgConfidence = null;
  if (confidenceScores.length > 0) {
    avgConfidence = confidenceScores.reduce((a,b)=>a+b, 0) / confidenceScores.length;
  }

  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`http://localhost:5000/api/interview/${interviewId}/feedback`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({
        avgConfidence: avgConfidence !== null ? Math.round(avgConfidence) : null
      })
    });
    const data = await res.json();
    if (res.ok) {
      const fb = data.feedback;
      const ovScore = fb.overall_score || 0;
      const commScore = fb.communication || 0;
      const techScore = fb.technical || 0;

      document.getElementById('fbOverall').textContent = ovScore;
      document.getElementById('fbComm').textContent    = commScore;
      document.getElementById('fbTech').textContent    = techScore;
      
      // Update progress bars
      setTimeout(() => {
        const obar = document.getElementById('fbOverallBar');
        if (obar) obar.style.width = ovScore + '%';
        const cbar = document.getElementById('fbCommBar');
        if (cbar) cbar.style.width = commScore + '%';
        const tbar = document.getElementById('fbTechBar');
        if (tbar) tbar.style.width = techScore + '%';
      }, 100);

      const strengthsUl = document.getElementById('fbStrengths');
      if (strengthsUl) {
        strengthsUl.innerHTML = '';
        if (Array.isArray(fb.strengths) && fb.strengths.length > 0) {
          fb.strengths.forEach(s => {
            const li = document.createElement('li');
            li.textContent = s;
            li.style.marginBottom = '8px';
            strengthsUl.appendChild(li);
          });
        } else {
          strengthsUl.innerHTML = '<li>Good overall effort.</li>';
        }
      }

      const weaknessesUl = document.getElementById('fbWeaknesses');
      if (weaknessesUl) {
        weaknessesUl.innerHTML = '';
        if (Array.isArray(fb.weaknesses) && fb.weaknesses.length > 0) {
          fb.weaknesses.forEach(w => {
            const li = document.createElement('li');
            li.textContent = w;
            li.style.marginBottom = '8px';
            weaknessesUl.appendChild(li);
          });
        } else {
          weaknessesUl.innerHTML = '<li>No major areas to improve.</li>';
        }
      }

      let extraNotes = '';
      if (totalFrames > 0) {
        const avgConfidence = confidenceScores.reduce((a,b)=>a+b, 0) / confidenceScores.length;
        const eyeContactPercent = (eyeContactFrames / totalFrames) * 100;
        
        if (avgConfidence < 50) {
          extraNotes += `<div style="color: #ff6b6b; margin-top: 10px;">⚠️ <strong>Low confidence detected</strong> during the session (Average: ${Math.round(avgConfidence)}%). Try to relax and maintain a positive expression!</div>`;
        } else {
          extraNotes += `<div style="color: #22d3a5; margin-top: 10px;">✅ <strong>Good confidence</strong> maintained throughout! (Average: ${Math.round(avgConfidence)}%)</div>`;
        }
        
        if (eyeContactPercent < 50) {
          extraNotes += `<div style="color: #facc15; margin-top: 10px;">⚠️ <strong>Poor eye contact</strong> (${Math.round(eyeContactPercent)}%). Remember to look at the camera to engage the interviewer.</div>`;
        } else {
          extraNotes += `<div style="color: #22d3a5; margin-top: 10px;">✅ <strong>Great eye contact</strong> (${Math.round(eyeContactPercent)}%).</div>`;
        }
      }

      const summaryEl = document.getElementById('fbSummary');
      if (summaryEl) summaryEl.innerHTML = (fb.feedback_summary || '') + extraNotes;
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
  stopFaceTracking();
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
