// Chatbot — Gemini AI-powered with SSE Streaming + Function Calling
import { $, escapeHtml } from '../core/utils.js';

const QUICK = ['Gợi ý đồ uống', 'Giờ mở cửa', 'Đặt bàn', 'Khuyến mãi', 'Chi nhánh'];

let conversationHistory = [];
let isOpen = false;

async function botReply(text, onToken, onStatus) {
  conversationHistory.push({ role: 'user', content: text });

  if (conversationHistory.length > 20) {
    conversationHistory = conversationHistory.slice(-20);
  }

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: conversationHistory }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullReply = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]' || data === '{}') continue;

        try {
          const event = JSON.parse(data);
          if (event.type === 'token') {
            fullReply += event.text;
            onToken(fullReply);
          } else if (event.type === 'status') {
            onStatus(event.text);
          } else if (event.type === 'error') {
            fullReply = event.text;
            onToken(fullReply);
          }
        } catch { /* ignore parse errors */ }
      }
    }

    if (fullReply) {
      conversationHistory.push({ role: 'model', content: fullReply });
    }
    return fullReply || 'Dạ em chưa có thông tin này ạ.';
  } catch (err) {
    console.error('[chatbot]', err);
    conversationHistory.pop();
    return 'Dạ em gặp sự cố kỹ thuật, anh/chị vui lòng thử lại sau ạ.';
  }
}

export function initChatbot() {
  if ($('#chatbot-fab')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="fab-stack">
      <button class="fab" id="music-fab" style="display:none"></button>
      <div class="chatbot-panel" id="chatbot-panel" role="dialog" aria-label="Chat với quán">
        <div class="cb-head">
          <img src="/images/logo.svg" width="34" height="34" alt="">
          <div><strong>Trợ lý Coffee Home</strong><br><small style="opacity:.8">AI hỗ trợ 24/7</small></div>
          <span class="cb-status"><span class="cb-dot"></span>Online</span>
        </div>
        <div class="cb-msgs" id="cb-msgs">
          <div class="cb-msg bot">Xin chào ☕ Em là trợ lý AI của Coffee Home. Anh/chị muốn tư vấn đồ uống, kiểm tra đơn hay tìm chi nhánh ạ?</div>
        </div>
        <div class="cb-chips">${QUICK.map(q => `<button type="button">${q}</button>`).join('')}</div>
        <form class="cb-input" id="cb-form">
          <input type="text" placeholder="Nhập câu hỏi…" autocomplete="off">
          <button type="submit" aria-label="Gửi"><i class="fa-solid fa-paper-plane"></i></button>
        </form>
      </div>
      <button class="fab" id="chatbot-fab" aria-label="Chatbot"><i class="fa-solid fa-comments"></i></button>
    </div>`);

  const panel = $('#chatbot-panel');
  const msgs = $('#cb-msgs');

  const addBot = (html) => {
    msgs.insertAdjacentHTML('beforeend', `<div class="cb-msg bot">${html}</div>`);
    msgs.scrollTop = msgs.scrollHeight;
  };

  const addUser = (text) => {
    msgs.insertAdjacentHTML('beforeend', `<div class="cb-msg me">${escapeHtml(text)}</div>`);
    msgs.scrollTop = msgs.scrollHeight;
  };

  $('#chatbot-fab').addEventListener('click', () => {
    panel.classList.toggle('open');
    isOpen = panel.classList.contains('open');
    if (isOpen) $('input', panel)?.focus();
  });

  const send = async (text) => {
    addUser(text);

    // Tạo bot message element trống để stream vào
    const botEl = document.createElement('div');
    botEl.className = 'cb-msg bot streaming';
    botEl.innerHTML = '<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span> Đang suy nghĩ…';
    msgs.appendChild(botEl);
    msgs.scrollTop = msgs.scrollHeight;

    let streaming = false;

    await botReply(text,
      // onToken — nhận từng token
      (fullText) => {
        if (!streaming) {
          streaming = true;
          botEl.classList.remove('typing');
        }
        // Render markdown cơ bản
        botEl.innerHTML = renderSimpleMd(fullText);
        msgs.scrollTop = msgs.scrollHeight;
      },
      // onStatus — trạng thái tool calling
      (statusText) => {
        botEl.innerHTML = `<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span> ${escapeHtml(statusText)}`;
        msgs.scrollTop = msgs.scrollHeight;
      }
    );

    // Đảm bảo có nội dung
    if (!streaming) {
      botEl.innerHTML = botEl.textContent || 'Dạ em chưa có thông tin này ạ.';
    }
    botEl.classList.remove('streaming');
  };

  $('#cb-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('input', e.target);
    const v = input.value.trim();
    if (!v) return;
    input.value = '';
    send(v);
  });
  $('.cb-chips').addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') send(e.target.textContent);
  });

  window.__fabStackReady = true;
  window.dispatchEvent(new Event('fabstack:ready'));
}

/** Render markdown cơ bản: bold, bullet, heading */
function renderSimpleMd(text) {
  let html = escapeHtml(text);
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Headings
  html = html.replace(/^### (.+)$/gm, '<strong style="font-size:.95em">$1</strong>');
  html = html.replace(/^## (.+)$/gm, '<strong style="font-size:1em">$1</strong>');
  // Bullet points
  html = html.replace(/^[*\-] (.+)$/gm, '• $1');
  // Line breaks
  html = html.replace(/\n/g, '<br>');
  return html;
}
