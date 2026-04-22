/**
 * chat.js – handles the AI Career Coach chat interface
 * Expects: token in localStorage, API at /api/chat
 */

const chatInput   = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatBox     = document.getElementById('chatBox');

// Helper to format markdown-like bold (basic)
function formatMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

function addMessage(text, sender) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${sender}`;
  
  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = sender === 'ai' ? '🤖' : '👤';
  
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = formatMarkdown(text);
  
  if (sender === 'user') {
    msgDiv.appendChild(bubble);
    msgDiv.appendChild(avatar);
  } else {
    msgDiv.appendChild(avatar);
    msgDiv.appendChild(bubble);
  }
  
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function showTypingIndicator() {
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ai typing-indicator`;
  msgDiv.id = 'typingIndicator';
  
  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = '🤖';
  
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  
  msgDiv.appendChild(avatar);
  msgDiv.appendChild(bubble);
  
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function hideTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) indicator.remove();
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  // Add user message
  addMessage(text, 'user');
  chatInput.value = '';
  chatSendBtn.disabled = true;

  // Show AI typing
  showTypingIndicator();

  try {
    const res = await fetch('http://localhost:5000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ prompt: text })
    });

    const data = await res.json();
    hideTypingIndicator();

    if (res.ok) {
      addMessage(data.reply, 'ai');
    } else {
      addMessage(`Error: ${data.message}`, 'ai');
    }
  } catch (err) {
    hideTypingIndicator();
    addMessage('Sorry, I am having trouble connecting to the server.', 'ai');
  } finally {
    chatSendBtn.disabled = false;
    chatInput.focus();
  }
}

if (chatSendBtn && chatInput) {
  chatSendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}
