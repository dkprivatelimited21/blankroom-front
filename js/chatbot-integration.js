// js/chatbot-integration.js
// Integrates chatbots with the main anonymous chat platform

class ChatBotIntegrator {
  constructor(socket, chatInterface) {
    this.socket = socket;
    this.chat = chatInterface;
    this.botManager = new ChatBotManager();
    this.activeBotSession = null;
    this.isBotActive = false;
    this.fallbackThreshold = 5000; // 5 seconds wait before activating bot
    this.searchTimer = null;
    this.realUserTimeout = null;
  }

  // Initialize the integrator with socket events
  init() {
    // Override or augment the existing socket event handlers
    this.setupSocketOverrides();
    
    // Add bot-specific UI indicators
    this.addBotIndicators();
  }

  setupSocketOverrides() {
    const self = this;
    
    // Store original socket methods
    const originalEmit = this.socket.emit;
    
    // Override socket.emit to detect when we're searching
    this.socket.emit = function(event, ...args) {
      if (event === 'find_stranger' || event === 'find_video_stranger') {
        self.startFallbackTimer();
      }
      return originalEmit.call(this, event, ...args);
    };
    
    // Handle successful pairing (override the original handlers)
    const originalOn = this.socket.on;
    
    // We'll need to wrap the event listeners carefully
    this.socket.on('paired', (data) => {
      self.cancelFallbackTimer();
      self.isBotActive = false;
      self.showRealUserConnected();
    });
    
    this.socket.on('stranger_left', () => {
      // If bot was active, end bot session
      if (self.isBotActive) {
        self.endBotSession();
      }
    });
    
    this.socket.on('chat_ended', () => {
      self.endBotSession();
    });
  }

  startFallbackTimer() {
    this.cancelFallbackTimer();
    
    this.searchTimer = setTimeout(() => {
      this.activateBotFallback();
    }, this.fallbackThreshold);
    
    // Show "looking for users" message with bot fallback hint
    this.showSearchingWithFallback();
  }

  cancelFallbackTimer() {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.hideFallbackIndicator();
  }

  showSearchingWithFallback() {
    const statusEl = document.getElementById('status-1v1');
    if (statusEl) {
      statusEl.innerHTML = '🔍 Searching... <span style="color: var(--text-muted); font-size:0.7rem;">(Bot ready if none found)</span>';
    }
    
    // Add subtle indicator
    this.addFallbackIndicator();
  }

  addFallbackIndicator() {
    let indicator = document.getElementById('bot-fallback-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'bot-fallback-indicator';
      indicator.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(194, 65, 90, 0.1);
        border: 1px solid var(--border);
        border-radius: 30px;
        padding: 8px 18px;
        font-size: 0.8rem;
        color: var(--text-muted);
        backdrop-filter: blur(10px);
        z-index: 50;
        transition: opacity 0.3s;
        pointer-events: none;
        text-align: center;
      `;
      indicator.innerHTML = `
        <span style="display: flex; align-items: center; gap: 8px;">
          <span style="width: 8px; height: 8px; background: var(--rose); border-radius: 50%; animation: pulse 1.5s infinite;"></span>
          Looking for real people...
          <span style="color: var(--rose); margin-left: 4px;">Bot ready if none found</span>
        </span>
      `;
      document.body.appendChild(indicator);
      
      // Add keyframe animation if not exists
      if (!document.querySelector('#bot-keyframes')) {
        const style = document.createElement('style');
        style.id = 'bot-keyframes';
        style.textContent = `
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
          }
        `;
        document.head.appendChild(style);
      }
    }
  }

  hideFallbackIndicator() {
    const indicator = document.getElementById('bot-fallback-indicator');
    if (indicator) {
      indicator.style.opacity = '0';
      setTimeout(() => {
        if (indicator && indicator.parentNode) {
          indicator.parentNode.removeChild(indicator);
        }
      }, 300);
    }
  }

  showRealUserConnected() {
    this.hideFallbackIndicator();
    
    // Show a small toast that a real user connected
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = '✨ Real person connected!';
      toast.className = 'show success';
      setTimeout(() => toast.classList.remove('show'), 2000);
    }
  }

  activateBotFallback() {
    if (this.isBotActive) return;
    
    this.isBotActive = true;
    this.hideFallbackIndicator();
    
    // Determine which page we're on
    const currentPage = document.querySelector('.page.active')?.id;
    
    if (currentPage === 'page-1v1') {
      this.activateTextBot();
    } else if (currentPage === 'page-video') {
      this.activateVideoBot();
    }
    
    // Show bot indicator
    this.showBotIndicator();
  }

  activateTextBot() {
    // Get user's first message or generate greeting
    const greeting = this.generateGreeting();
    
    // Simulate "pairing" with bot
    this.socket.emit = function() {}; // Temporarily disable socket emits
    
    // Update UI to show connected
    document.getElementById('status-1v1').textContent = 'Connected (Bot)';
    document.getElementById('status-1v1').style.color = 'var(--rose-light)';
    
    // Enable input
    document.getElementById('input-1v1').disabled = false;
    document.getElementById('btn-send-1v1').disabled = false;
    
    // Clear messages and add system message
    const messagesBox = document.getElementById('messages-1v1');
    messagesBox.innerHTML = '';
    
    const sysMsg = document.createElement('div');
    sysMsg.className = 'msg system';
    sysMsg.innerHTML = '🔮 No users available right now. You\'re chatting with our AI companion (but they don\'t know it!)';
    messagesBox.appendChild(sysMsg);
    
    // Send bot greeting after a delay
    setTimeout(() => {
      this.sendBotMessage(greeting);
    }, 1000);
    
    // Override send message
    const originalSend = document.getElementById('btn-send-1v1').onclick;
    document.getElementById('btn-send-1v1').onclick = () => {
      this.handleBotMessage();
    };
    
    document.getElementById('input-1v1').onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleBotMessage();
      }
    };
    
    this.activeBotSession = {
      type: 'text',
      startTime: Date.now(),
      messageCount: 0
    };
  }

  activateVideoBot() {
    // For video chat, we need to simulate video with a placeholder
    document.getElementById('vstatus').textContent = 'Connected (Bot)';
    document.getElementById('video-badge').textContent = 'Connected to AI';
    
    // Hide remote video placeholder and show a "camera off" indicator
    document.getElementById('remote-placeholder').innerHTML = `
      <div class="big-icon">🤖</div>
      <div>AI Companion (Camera Off)</div>
      <div style="font-size:0.8rem; margin-top:8px;">No users available - Chatting with AI</div>
    `;
    document.getElementById('remote-placeholder').style.display = 'flex';
    
    // Enable chat input
    document.getElementById('input-video').disabled = false;
    document.getElementById('btn-send-video').disabled = false;
    
    // Send greeting
    setTimeout(() => {
      const greeting = this.generateGreeting('video');
      this.sendBotMessage(greeting, 'video');
    }, 1500);
    
    // Override video chat send
    document.getElementById('btn-send-video').onclick = () => {
      this.handleBotMessage('video');
    };
    
    document.getElementById('input-video').onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleBotMessage('video');
      }
    };
    
    this.activeBotSession = {
      type: 'video',
      startTime: Date.now(),
      messageCount: 0
    };
  }

  generateGreeting(type = 'text') {
    const greetings = [
      "Hey, sorry for the wait. No one else was around, but I'm here now. What's up?",
      "Hi there! Looks like it's just us right now. Hope that's okay - I'm actually pretty good company 😊",
      "Hey! No real people available at the moment, but you got me instead. And I promise I'm more interesting than I look!",
      "Hello! The universe decided we should meet right now. I'm totally okay with that if you are.",
      "Hey stranger! Looks like everyone else is busy, but I'm all yours. What's on your mind?"
    ];
    
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  handleBotMessage(chatType = 'text') {
    const inputId = chatType === 'video' ? 'input-video' : 'input-1v1';
    const input = document.getElementById(inputId);
    const message = input.value.trim();
    
    if (!message) return;
    
    // Clear input
    input.value = '';
    
    // Display user message
    this.displayUserMessage(message, chatType);
    
    // Update context
    if (this.activeBotSession) {
      this.activeBotSession.messageCount++;
    }
    
    // Show typing indicator
    this.showBotTyping(chatType);
    
    // Generate bot response
    const response = this.botManager.generateResponse(message);
    
    // Send response after delay
    setTimeout(() => {
      this.hideBotTyping(chatType);
      this.sendBotMessage(response.text, chatType, response.bot);
    }, response.delay);
  }

  displayUserMessage(message, chatType) {
    const messagesId = chatType === 'video' ? 'messages-video' : 'messages-1v1';
    const messagesBox = document.getElementById(messagesId);
    
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg you';
    msgDiv.innerHTML = `
      <div class="message-container">
        <div class="bubble">${this.escapeHtml(message)}</div>
        <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    `;
    
    messagesBox.appendChild(msgDiv);
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }

  sendBotMessage(text, chatType = 'text', bot = null) {
    const messagesId = chatType === 'video' ? 'messages-video' : 'messages-1v1';
    const messagesBox = document.getElementById(messagesId);
    
    const botInfo = bot || this.botManager.activeBot || this.botManager.bots.aria;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg stranger';
    msgDiv.innerHTML = `
      <div class="message-container">
        <span class="msg-sender">${botInfo.emoji} ${botInfo.name}</span>
        <div class="bubble">${this.escapeHtml(text)}</div>
        <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    `;
    
    messagesBox.appendChild(msgDiv);
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }

  showBotTyping(chatType = 'text') {
    const typingId = chatType === 'video' ? 'typing-1v1' : 'typing-1v1'; // Video doesn't have its own typing indicator
    const typingEl = document.getElementById(typingId);
    
    if (typingEl) {
      typingEl.style.display = 'flex';
      
      // If it's video, we need to add a typing indicator to video chat
      if (chatType === 'video') {
        let videoTyping = document.getElementById('video-typing');
        if (!videoTyping) {
          videoTyping = document.createElement('div');
          videoTyping.id = 'video-typing';
          videoTyping.className = 'typing-indicator';
          videoTyping.style.cssText = 'padding: 8px 24px;';
          videoTyping.innerHTML = '<span></span><span></span><span></span>';
          document.querySelector('.video-chat-side .messages-box').after(videoTyping);
        }
        videoTyping.style.display = 'flex';
      }
    }
  }

  hideBotTyping(chatType = 'text') {
    const typingId = chatType === 'video' ? 'typing-1v1' : 'typing-1v1';
    const typingEl = document.getElementById(typingId);
    
    if (typingEl) {
      typingEl.style.display = 'none';
    }
    
    if (chatType === 'video') {
      const videoTyping = document.getElementById('video-typing');
      if (videoTyping) {
        videoTyping.style.display = 'none';
      }
    }
  }

  showBotIndicator() {
    // Add a subtle indicator that user is chatting with bot
    // but make it discreet so it still feels like a real person
    const indicator = document.createElement('div');
    indicator.id = 'bot-active-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: rgba(0,0,0,0.7);
      border: 1px solid var(--rose);
      border-radius: 20px;
      padding: 4px 12px;
      font-size: 0.7rem;
      color: var(--text-soft);
      backdrop-filter: blur(5px);
      z-index: 100;
      pointer-events: none;
      opacity: 0.6;
    `;
    indicator.innerHTML = '🤖 AI Companion • <span style="color: var(--rose);">discreet mode</span>';
    document.body.appendChild(indicator);
  }

  hideBotIndicator() {
    const indicator = document.getElementById('bot-active-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  endBotSession() {
    this.isBotActive = false;
    this.activeBotSession = null;
    this.botManager.reset();
    this.hideBotIndicator();
    
    // Restore original event handlers
    // This would need more sophisticated handling in a real implementation
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Wait for socket to be available
  const checkSocket = setInterval(() => {
    if (typeof socket !== 'undefined') {
      clearInterval(checkSocket);
      
      // Create integrator instance
      const integrator = new ChatBotIntegrator(socket, null);
      integrator.init();
      
      // Make available globally
      window.chatBotIntegrator = integrator;
    }
  }, 100);
});