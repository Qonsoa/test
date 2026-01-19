// widget/widget.js
(function () {
  "use strict";

  // ==================== CONFIGURATION ====================
  const CONFIG = {
    WORKER_URL: "https://groq-worker.zedbot.workers.dev",
    MODEL: "llama-3.1-8b-instant",
  };

  // Get token from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const BOT_TOKEN = urlParams.get('token');
  const DOMAIN = urlParams.get('domain');

  if (!BOT_TOKEN) {
    console.error("❌ Dental Widget Error: Missing token parameter");
    return;
  }

  // ==================== UNIQUE ID ====================
  const UNIQUE_ID = `dental-widget-${Math.random().toString(36).substr(2, 9)}`;

  // ==================== STATE MANAGEMENT ====================
  let state = {
    isOpen: false,
    clinicData: null,
    messageHistory: [],
    cachedResponses: new Map(),
    quickRepliesCache: null
  };

  // ==================== DOM CREATION ====================
  function createWidgetDOM() {
    const app = document.getElementById('app');
    
    const widgetHTML = `
      <div class="chat-widget-container" id="${UNIQUE_ID}">
        <div class="chat-icon" id="chatIcon">
          <svg viewBox="0 0 24 24" fill="white" width="24" height="24">
            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
          </svg>
        </div>
        
        <div class="chat-container" id="chatContainer">
          <div class="chat-header">
            <div class="clinic-info">
              <h3 id="clinicName">Loading...</h3>
            </div>
            <button class="close-btn" id="closeChat">×</button>
          </div>
          
          <div class="chat-messages" id="chatMessages">
            <div class="welcome-text" id="welcomeText">
              <strong>Welcome!</strong>
              <p>Loading clinic information...</p>
            </div>
          </div>
          
          <div class="chat-input-area">
            <div class="input-wrapper">
              <textarea 
                id="messageInput" 
                class="message-input"
                placeholder="Ask a question..." 
                rows="1"
              ></textarea>
              <button class="send-button" id="sendButton">
                <svg viewBox="0 0 24 24" fill="white" width="20" height="20">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
            <div class="quick-questions" id="quickQuestions">
              <!-- Quick replies will be loaded here -->
            </div>
          </div>
        </div>
      </div>
    `;
    
    app.innerHTML = widgetHTML;
  }

  // ==================== CACHE MANAGEMENT ====================
  const CacheManager = {
    // Local storage for common questions
    getCachedResponse: function(question) {
      const key = `response_${question.toLowerCase().replace(/\s+/g, '_')}`;
      return state.cachedResponses.get(key);
    },
    
    setCachedResponse: function(question, response) {
      const key = `response_${question.toLowerCase().replace(/\s+/g, '_')}`;
      state.cachedResponses.set(key, response);
      
      // Also store in localStorage for persistence
      try {
        const cache = JSON.parse(localStorage.getItem('dental_widget_cache') || '{}');
        cache[key] = {
          response,
          timestamp: Date.now()
        };
        localStorage.setItem('dental_widget_cache', JSON.stringify(cache));
      } catch (e) {
        // Silent fail
      }
    },
    
    loadCacheFromStorage: function() {
      try {
        const cache = JSON.parse(localStorage.getItem('dental_widget_cache') || '{}');
        Object.entries(cache).forEach(([key, value]) => {
          // Check if cache is not older than 24 hours
          if (Date.now() - value.timestamp < 24 * 60 * 60 * 1000) {
            state.cachedResponses.set(key, value.response);
          }
        });
      } catch (e) {
        // Silent fail
      }
    }
  };

  // ==================== API COMMUNICATION ====================
  async function fetchClinicData() {
    try {
      const response = await fetch(`${CONFIG.WORKER_URL}/get-clinic/${BOT_TOKEN}`, {
        headers: {
          'X-Origin-Domain': DOMAIN,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Clinic not found: ${response.status}`);
      }

      const clinic = await response.json();
      return clinic;
    } catch (error) {
      console.error('Failed to fetch clinic data:', error);
      return null;
    }
  }

  async function sendToAI(userMessage) {
    // Check cache first
    const cached = CacheManager.getCachedResponse(userMessage);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${CONFIG.WORKER_URL}/chat/${BOT_TOKEN}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'X-Origin-Domain': DOMAIN
        },
        body: JSON.stringify({
          model: CONFIG.MODEL,
          messages: [...state.messageHistory, { role: "user", content: userMessage }],
          temperature: 0.4,
          max_tokens: 512
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const botResponse = data.choices[0].message.content;
      
      // Cache the response
      CacheManager.setCachedResponse(userMessage, botResponse);
      
      return botResponse;
    } catch (error) {
      console.error("API Error:", error);
      return `I apologize, but I'm having trouble connecting right now. 😅 For immediate assistance, please call the clinic directly.`;
    }
  }

  // ==================== CHAT UI MANAGEMENT ====================
  function initChatUI(clinic) {
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const chatIcon = document.getElementById('chatIcon');
    const chatContainer = document.getElementById('chatContainer');
    const closeChat = document.getElementById('closeChat');
    const clinicName = document.getElementById('clinicName');
    const quickQuestions = document.getElementById('quickQuestions');

    // Set clinic name
    clinicName.textContent = clinic.name;

    // Load quick questions
    loadQuickQuestions(clinic, quickQuestions);

    // Event Listeners
    chatIcon.addEventListener("click", toggleChat);
    closeChat.addEventListener("click", closeChatWindow);
    
    sendButton.addEventListener("click", async () => {
      await handleSendMessage();
    });

    messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    messageInput.addEventListener("input", updateSendButton);

    // Functions
    function toggleChat() {
      state.isOpen = !state.isOpen;
      chatContainer.classList.toggle("open", state.isOpen);
      
      // Notify parent iframe about resize
      if (window.notifyParentResize) {
        window.notifyParentResize(state.isOpen ? 'open' : 'closed');
      }
      
      if (state.isOpen) {
        messageInput.focus();
      }
    }

    function closeChatWindow() {
      state.isOpen = false;
      chatContainer.classList.remove("open");
      
      if (window.notifyParentResize) {
        window.notifyParentResize('closed');
      }
    }

    async function handleSendMessage() {
      const message = messageInput.value.trim();
      if (!message) return;

      addMessage(message, true);
      messageInput.value = "";
      updateSendButton();

      const response = await sendToAI(message);
      addMessage(response, false);
    }

    function addMessage(content, isUser) {
      const messageDiv = document.createElement("div");
      messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
      
      const time = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      messageDiv.innerHTML = `
        <div class="message-content">${content}</div>
        <div class="message-time">${time}</div>
      `;

      chatMessages.appendChild(messageDiv);
      scrollToBottom();
    }

    function updateSendButton() {
      sendButton.disabled = messageInput.value.trim() === "";
    }

    function scrollToBottom() {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  function loadQuickQuestions(clinic, container) {
    const questions = [
      { text: "🕐 Hours", question: "What are your opening hours?" },
      { text: "📍 Location", question: "Where is your clinic located?" },
      { text: "📅 Appointment", question: "I want to book an appointment" },
      { text: "🚑 Emergency", question: "I have a dental emergency" }
    ];

    container.innerHTML = questions.map(q => `
      <button class="quick-btn" data-question="${q.question}">
        ${q.text}
      </button>
    `).join('');

    // Add event listeners
    container.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const question = e.target.dataset.question;
        addMessage(question, true);
        
        const response = await sendToAI(question);
        addMessage(response, false);
      });
    });
  }

  // ==================== INITIALIZATION ====================
  async function init() {
    // Load cache from storage
    CacheManager.loadCacheFromStorage();
    
    // Create DOM
    createWidgetDOM();
    
    // Fetch clinic data
    const clinic = await fetchClinicData();
    
    if (!clinic) {
      document.getElementById('clinicName').textContent = 'Dental Clinic';
      document.getElementById('welcomeText').innerHTML = `
        <strong>Welcome!</strong>
        <p>Unable to load clinic information. Please refresh.</p>
      `;
      return;
    }
    
    // Initialize chat UI with clinic data
    initChatUI(clinic);
    
    // Update welcome text
    document.getElementById('welcomeText').innerHTML = `
      <strong>Welcome to ${clinic.name}!</strong>
      <p>How can I help you today?</p>
    `;
    
    console.log(`✅ Dental Widget loaded for: ${clinic.name}`);
  }

  // ==================== STARTUP ====================
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();