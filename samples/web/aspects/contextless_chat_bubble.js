(function () {
  'use strict';

  // ============== STYLES ==============
  const styles = `
        .chatbot-widget * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        .chat-bubble {
            position: fixed;
            bottom: 25px;
            right: 25px;
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(102, 126, 234, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.3s, box-shadow 0.3s;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .chat-bubble:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 25px rgba(102, 126, 234, 0.6);
        }

        .chat-bubble-icon {
            font-size: 28px;
            transition: transform 0.3s;
        }

        .chat-bubble.open .chat-bubble-icon {
            transform: rotate(180deg);
        }

        .chat-badge {
            position: absolute;
            top: -5px;
            right: -5px;
            width: 22px;
            height: 22px;
            background: #ff4757;
            border-radius: 50%;
            color: white;
            font-size: 12px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
        }

        .chat-badge.hidden {
            display: none;
        }

        .chat-container {
            position: fixed;
            bottom: 100px;
            right: 25px;
            width: 380px;
            max-height: 550px;
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            overflow: hidden;
            z-index: 9999;
            opacity: 0;
            visibility: hidden;
            transform: translateY(20px) scale(0.95);
            transition: all 0.3s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .chat-container.open {
            opacity: 1;
            visibility: visible;
            transform: translateY(0) scale(1);
        }

        @media (max-width: 480px) {
            .chat-container {
                width: calc(100% - 20px);
                right: 10px;
                bottom: 90px;
                max-height: calc(100vh - 120px);
            }

            .chat-bubble {
                right: 15px;
                bottom: 15px;
            }
        }

        .chat-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 18px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .chat-header-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .chat-header-avatar {
            width: 40px;
            height: 40px;
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }

        .chat-header-text h3 {
            font-size: 1rem;
            font-weight: 600;
            margin-bottom: 2px;
        }

        .chat-header-text p {
            font-size: 0.75rem;
            opacity: 0.9;
        }

        .online-dot {
            width: 8px;
            height: 8px;
            background: #2ecc71;
            border-radius: 50%;
            display: inline-block;
            margin-right: 5px;
            animation: chatbot-pulse 2s infinite;
        }

        @keyframes chatbot-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .chat-close {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }

        .chat-close:hover {
            background: rgba(255,255,255,0.3);
        }

        .chat-messages {
            height: 350px;
            overflow-y: auto;
            padding: 20px;
            background: #f8f9fa;
        }

        .chat-message {
            margin-bottom: 15px;
            display: flex;
            align-items: flex-end;
            gap: 8px;
        }

        .chat-message.user {
            flex-direction: row-reverse;
        }

        .message-avatar {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            flex-shrink: 0;
        }

        .chat-message.bot .message-avatar {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .chat-message.user .message-avatar {
            background: #e9ecef;
        }

        .message-content {
            max-width: 75%;
            padding: 10px 14px;
            border-radius: 16px;
            line-height: 1.4;
            font-size: 0.9rem;
        }

        .chat-message.bot .message-content {
            background: white;
            color: #333;
            border-bottom-left-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }

        .chat-message.user .message-content {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-bottom-right-radius: 4px;
        }

        .message-time {
            font-size: 0.7rem;
            color: #999;
            margin-top: 4px;
            text-align: right;
        }

        .chat-message.bot .message-time {
            text-align: left;
        }

        .typing-indicator {
            display: flex;
            gap: 4px;
            padding: 10px 14px;
            background: white;
            border-radius: 16px;
            border-bottom-left-radius: 4px;
            width: fit-content;
        }

        .typing-indicator span {
            width: 7px;
            height: 7px;
            background: #667eea;
            border-radius: 50%;
            animation: chatbot-bounce 1.4s infinite ease-in-out;
        }

        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

        @keyframes chatbot-bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
        }

        .quick-replies {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            padding: 0 15px 12px;
            background: #f8f9fa;
        }

        .quick-reply {
            padding: 6px 14px;
            background: white;
            border: 1px solid #667eea;
            color: #667eea;
            border-radius: 16px;
            font-size: 0.8rem;
            cursor: pointer;
            transition: all 0.2s;
        }

        .quick-reply:hover {
            background: #667eea;
            color: white;
        }

        .chat-input-container {
            display: flex;
            padding: 12px 15px;
            background: white;
            border-top: 1px solid #eee;
            gap: 10px;
        }

        .chat-input {
            flex: 1;
            padding: 10px 16px;
            border: 2px solid #e9ecef;
            border-radius: 22px;
            font-size: 0.9rem;
            outline: none;
            transition: border-color 0.3s;
            font-family: inherit;
        }

        .chat-input:focus {
            border-color: #667eea;
        }

        .send-button {
            width: 40px;
            height: 40px;
            border: none;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .send-button:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .send-button:active {
            transform: scale(0.95);
        }

        .chat-footer {
            text-align: center;
            padding: 8px;
            background: #f8f9fa;
            font-size: 0.7rem;
            color: #999;
            border-top: 1px solid #eee;
        }
    `;

  // ============== STATE ==============
  let isOpen = false;
  let hasOpenedOnce = false;

  // ============== RESPONSES ==============
  const responses = {
    greetings: [
      'hello',
      'hi',
      'hey',
      'good morning',
      'good afternoon',
      'good evening',
    ],
    goodbye: ['bye', 'goodbye', 'see you', 'later', 'quit'],
    thanks: ['thank', 'thanks', 'appreciate'],
    help: ['help', 'support', 'assist', 'what can you do'],
    joke: ['joke', 'funny', 'laugh', 'humor'],
    time: ['time', 'clock', 'what time'],
    date: ['date', 'today', 'what day'],
    name: ['your name', 'who are you', 'what are you'],
    feeling: ['how are you', 'how do you feel', "what's up"],
  };

  const replies = {
    greetings: [
      'Hello! 👋 How can I help you today?',
      'Hi there! Nice to meet you! 😊',
      "Hey! What's on your mind?",
    ],
    goodbye: [
      'Goodbye! Have a great day! 👋',
      'See you later! Take care! 😊',
      'Bye! Come back anytime!',
    ],
    thanks: [
      "You're welcome! 😊",
      'Happy to help!',
      'Anytime! Let me know if you need anything else.',
    ],
    help: [
      'I can help you with:\n• Answering questions\n• Telling jokes\n• Showing the time/date\n• General conversation\n\nJust type your question!',
    ],
    joke: [
      "Why don't scientists trust atoms? Because they make up everything! 😄",
      'Why did the scarecrow win an award? He was outstanding in his field! 🌾',
      "Why don't eggs tell jokes? They'd crack each other up! 🥚",
      'What do you call a fake noodle? An impasta! 🍝',
    ],
    time: function () {
      return 'The current time is ' + new Date().toLocaleTimeString() + ' ⏰';
    },
    date: function () {
      return (
        'Today is ' +
        new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }) +
        ' 📅'
      );
    },
    name: [
      "I'm ChatBot, your friendly AI assistant! 🤖",
      "You can call me ChatBot! I'm here to help. 😊",
    ],
    feeling: [
      "I'm doing great, thanks for asking! 😊 How about you?",
      "I'm feeling helpful today! What can I do for you?",
    ],
    default: [
      'Interesting! Tell me more about that.',
      "I'm not sure I understand. Could you rephrase that?",
      "That's a great question! Let me think... 🤔",
      "Hmm, I'm still learning. Try asking me about jokes, time, or type 'help'.",
    ],
  };

  // ============== HELPER FUNCTIONS ==============
  function createElement(tag, className, attributes, innerHTML) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (attributes) {
      for (const key in attributes) {
        el.setAttribute(key, attributes[key]);
      }
    }
    if (innerHTML) el.innerHTML = innerHTML;
    return el;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getTime() {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function generateResponse(message) {
    const lowerMessage = message.toLowerCase();

    for (const category in responses) {
      const keywords = responses[category];
      const found = keywords.some(function (keyword) {
        return lowerMessage.includes(keyword);
      });

      if (found) {
        const categoryReplies = replies[category];
        if (typeof categoryReplies === 'function') {
          return categoryReplies();
        }
        return categoryReplies[
          Math.floor(Math.random() * categoryReplies.length)
        ];
      }
    }

    return replies.default[Math.floor(Math.random() * replies.default.length)];
  }

  // ============== DOM CREATION ==============
  function injectStyles() {
    const styleEl = document.createElement('style');
    styleEl.id = 'chatbot-widget-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  function createChatBubble() {
    const bubble = createElement('div', 'chat-bubble', { id: 'chatBubble' });

    const icon = createElement(
      'span',
      'chat-bubble-icon',
      { id: 'bubbleIcon' },
      '💬'
    );
    const badge = createElement('span', 'chat-badge', { id: 'chatBadge' }, '1');

    bubble.appendChild(icon);
    bubble.appendChild(badge);

    bubble.addEventListener('click', toggleChat);

    return bubble;
  }

  function createChatContainer() {
    const container = createElement('div', 'chat-container', {
      id: 'chatContainer',
    });

    // Header
    const header = createElement('div', 'chat-header');

    const headerInfo = createElement('div', 'chat-header-info');
    const headerAvatar = createElement('div', 'chat-header-avatar', null, '🤖');
    const headerText = createElement('div', 'chat-header-text');
    headerText.innerHTML =
      '<h3>ChatBot Assistant</h3><p><span class="online-dot"></span>Online</p>';

    headerInfo.appendChild(headerAvatar);
    headerInfo.appendChild(headerText);

    const closeBtn = createElement('button', 'chat-close', null, '✕');
    closeBtn.addEventListener('click', toggleChat);

    header.appendChild(headerInfo);
    header.appendChild(closeBtn);

    // Messages area
    const messages = createElement('div', 'chat-messages', {
      id: 'chatMessages',
    });

    // Quick replies
    const quickReplies = createElement('div', 'quick-replies', {
      id: 'quickReplies',
    });
    const quickReplyOptions = [
      { text: 'Hello!', value: 'Hello!' },
      { text: 'What can you do?', value: 'What can you do?' },
      { text: 'Joke', value: 'Tell me a joke' },
      { text: 'Help', value: 'Help' },
    ];

    quickReplyOptions.forEach(function (option) {
      const btn = createElement('button', 'quick-reply', null, option.text);
      btn.addEventListener('click', function () {
        sendQuickReply(option.value);
      });
      quickReplies.appendChild(btn);
    });

    // Input area
    const inputContainer = createElement('div', 'chat-input-container');

    const input = createElement('input', 'chat-input', {
      id: 'userInput',
      type: 'text',
      placeholder: 'Type a message...',
      autocomplete: 'off',
    });

    input.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });

    const sendBtn = createElement('button', 'send-button', null, '➤');
    sendBtn.addEventListener('click', sendMessage);

    inputContainer.appendChild(input);
    inputContainer.appendChild(sendBtn);

    // Footer
    const footer = createElement(
      'div',
      'chat-footer',
      null,
      'Powered by ChatBot'
    );

    // Assemble container
    container.appendChild(header);
    container.appendChild(messages);
    container.appendChild(quickReplies);
    container.appendChild(inputContainer);
    container.appendChild(footer);

    return container;
  }

  // ============== CHAT FUNCTIONS ==============
  function toggleChat() {
    isOpen = !isOpen;
    const container = document.getElementById('chatContainer');
    const bubble = document.getElementById('chatBubble');
    const bubbleIcon = document.getElementById('bubbleIcon');
    const badge = document.getElementById('chatBadge');

    if (isOpen) {
      container.classList.add('open');
      bubble.classList.add('open');
      bubbleIcon.textContent = '✕';
      badge.classList.add('hidden');

      if (!hasOpenedOnce) {
        hasOpenedOnce = true;
        setTimeout(function () {
          addBotMessage(
            "Hello! 👋 I'm your ChatBot assistant. How can I help you today?"
          );
        }, 300);
      }

      setTimeout(function () {
        document.getElementById('userInput').focus();
      }, 300);
    } else {
      container.classList.remove('open');
      bubble.classList.remove('open');
      bubbleIcon.textContent = '💬';
    }
  }

  function sendMessage() {
    const input = document.getElementById('userInput');
    const message = input.value.trim();

    if (message === '') return;

    addUserMessage(message);
    input.value = '';

    showTyping();

    setTimeout(function () {
      hideTyping();
      const response = generateResponse(message);
      addBotMessage(response);
    }, 800 + Math.random() * 700);
  }

  function sendQuickReply(message) {
    document.getElementById('userInput').value = message;
    sendMessage();
  }

  function addUserMessage(message) {
    const messagesDiv = document.getElementById('chatMessages');

    const messageEl = createElement('div', 'chat-message user');
    messageEl.innerHTML =
      '<div class="message-avatar">👤</div>' +
      '<div>' +
      '<div class="message-content">' +
      escapeHtml(message) +
      '</div>' +
      '<div class="message-time">' +
      getTime() +
      '</div>' +
      '</div>';

    messagesDiv.appendChild(messageEl);
    scrollToBottom();
  }

  function addBotMessage(message) {
    const messagesDiv = document.getElementById('chatMessages');

    const messageEl = createElement('div', 'chat-message bot');
    messageEl.innerHTML =
      '<div class="message-avatar">🤖</div>' +
      '<div>' +
      '<div class="message-content">' +
      escapeHtml(message).replace(/\n/g, '<br>') +
      '</div>' +
      '<div class="message-time">' +
      getTime() +
      '</div>' +
      '</div>';

    messagesDiv.appendChild(messageEl);
    scrollToBottom();
  }

  function showTyping() {
    const messagesDiv = document.getElementById('chatMessages');

    const typingEl = createElement('div', 'chat-message bot', {
      id: 'typingIndicator',
    });
    typingEl.innerHTML =
      '<div class="message-avatar">🤖</div>' +
      '<div class="typing-indicator">' +
      '<span></span>' +
      '<span></span>' +
      '<span></span>' +
      '</div>';

    messagesDiv.appendChild(typingEl);
    scrollToBottom();
  }

  function hideTyping() {
    const typing = document.getElementById('typingIndicator');
    if (typing) typing.remove();
  }

  function scrollToBottom() {
    const messagesDiv = document.getElementById('chatMessages');
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // ============== INITIALIZATION ==============
  function init() {
    // Inject styles
    injectStyles();

    // Create wrapper
    const wrapper = createElement('div', 'chatbot-widget');

    // Create and append elements
    const bubble = createChatBubble();
    const container = createChatContainer();

    wrapper.appendChild(bubble);
    wrapper.appendChild(container);

    // Append to body
    document.body.appendChild(wrapper);

    // Close on outside click
    document.addEventListener('click', function (e) {
      const container = document.getElementById('chatContainer');
      const bubble = document.getElementById('chatBubble');

      if (
        isOpen &&
        !container.contains(e.target) &&
        !bubble.contains(e.target)
      ) {
        toggleChat();
      }
    });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
