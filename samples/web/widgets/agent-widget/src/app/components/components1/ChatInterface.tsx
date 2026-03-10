/**
 * ChatInterface Component
 *
 * Main chat interface for interacting with the agent
 */

import React, { useState, useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { agentService } from '../services/agentService';
import type { Message, AgentStatus, AgentError } from '../types/agent';
import type { BrandingConfig } from '../types/branding';
import { defaultBranding } from '../types/branding';

interface ChatInterfaceProps {
  branding?: BrandingConfig | null | undefined;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ branding }) => {
  // Use provided branding or fallback to default - ALWAYS have branding
  const effectiveBranding = branding || defaultBranding;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [error, setError] = useState<AgentError | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize agent service
  useEffect(() => {
    const initialize = async () => {
      try {
        await agentService.initialize();

        // Add welcome message
        const welcomeMessage: Message = {
          id: 'welcome',
          role: 'agent',
          content: "Hello! I'm your AI assistant. How can I help you today?",
          timestamp: new Date(),
        };
        setMessages([welcomeMessage]);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to initialize agent:', err);
        setError({
          code: 'INIT_ERROR',
          message: 'Failed to initialize agent service',
          retryable: true,
        });
      }
    };

    initialize();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || status === 'thinking') return;

    const userMessageText = inputValue.trim();
    setInputValue('');
    setError(null);
    setStatus('thinking');

    try {
      // Add user message to UI immediately
      const userMessage: Message = {
        id: `temp_${Date.now()}`,
        role: 'user',
        content: userMessageText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);

      // Get agent response
      const agentMessage = await agentService.sendMessage(userMessageText);

      // Add agent message to UI
      setMessages(prev => [...prev, agentMessage]);
      setStatus('idle');
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('Error sending message:', err);
      setError(err as AgentError);
      setStatus('error');

      // Show error message in chat
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: 'agent',
        content: `Sorry, I encountered an error: ${err.message}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleRetry = async () => {
    setError(null);
    setStatus('thinking');

    try {
      const agentMessage = await agentService.retryLastMessage();
      // Remove any error messages before adding the successful response
      setMessages(prev => {
        const filteredMessages = prev.filter(msg => !msg.id.startsWith('error_'));
        return [...filteredMessages, agentMessage];
      });
      setStatus('idle');
    } catch (err: any) {
      setError(err as AgentError);
      setStatus('error');
    }
  };

  const handleClearChat = () => {
    agentService.clearConversation();
    setMessages([]);
    setError(null);
    setStatus('idle');

    // Add welcome message
    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'agent',
      content: 'Chat cleared. How can I help you?',
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Styles - use effectiveBranding instead of branding
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '600px',
    backgroundColor: effectiveBranding.colors.background,
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    fontFamily: effectiveBranding.fonts.primary,
  };

  const headerStyle: React.CSSProperties = {
    padding: effectiveBranding.spacing.medium,
    backgroundColor: effectiveBranding.colors.primary,
    color: '#ffffff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: `1px solid ${effectiveBranding.colors.textSecondary}`,
  };

  const messagesContainerStyle: React.CSSProperties = {
    flex: 1,
    padding: effectiveBranding.spacing.medium,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: effectiveBranding.colors.background,
  };

  const inputContainerStyle: React.CSSProperties = {
    padding: effectiveBranding.spacing.medium,
    borderTop: `1px solid ${effectiveBranding.colors.surface}`,
    display: 'flex',
    gap: effectiveBranding.spacing.small,
    backgroundColor: effectiveBranding.colors.surface,
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: effectiveBranding.spacing.medium,
    borderRadius: '20px',
    border: `1px solid ${effectiveBranding.colors.textSecondary}`,
    outline: 'none',
    fontFamily: effectiveBranding.fonts.primary,
    fontSize: '14px',
    backgroundColor: effectiveBranding.colors.background,
  };

  const buttonStyle: React.CSSProperties = {
    padding: `${effectiveBranding.spacing.small}px ${effectiveBranding.spacing.medium}px`,
    borderRadius: '20px',
    border: 'none',
    backgroundColor: effectiveBranding.colors.primary,
    color: '#ffffff',
    cursor: 'pointer',
    fontFamily: effectiveBranding.fonts.primary,
    fontWeight: 600,
    fontSize: '14px',
    transition: 'opacity 0.2s',
  };

  const clearButtonStyle: React.CSSProperties = {
    padding: `${effectiveBranding.spacing.small}px ${effectiveBranding.spacing.medium}px`,
    borderRadius: '6px',
    border: '1px solid #ffffff',
    backgroundColor: 'transparent',
    color: '#ffffff',
    cursor: 'pointer',
    fontFamily: effectiveBranding.fonts.primary,
    fontSize: '12px',
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>AI Assistant</div>
          <div style={{ fontSize: '12px', opacity: 0.9 }}>
            {status === 'thinking' && 'Thinking...'}
            {status === 'idle' && 'Ready'}
            {status === 'error' && 'Error - Please retry'}
          </div>
        </div>
        <button style={clearButtonStyle} onClick={handleClearChat}>
          Clear Chat
        </button>
      </div>

      {/* Messages */}
      <div style={messagesContainerStyle}>
        {messages.map(message => (
          <MessageBubble key={message.id} message={message} branding={effectiveBranding} />
        ))}
        {status === 'thinking' && <TypingIndicator branding={effectiveBranding} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Banner */}
      {error && error.retryable && (
        <div
          style={{
            padding: effectiveBranding.spacing.small,
            backgroundColor: effectiveBranding.colors.error,
            color: '#ffffff',
            textAlign: 'center',
            fontSize: '14px',
          }}
        >
          {error.message}
          <button
            style={{
              marginLeft: effectiveBranding.spacing.medium,
              padding: `${effectiveBranding.spacing.small}px ${effectiveBranding.spacing.medium}px`,
              backgroundColor: '#ffffff',
              color: effectiveBranding.colors.error,
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontFamily: effectiveBranding.fonts.primary,
              fontSize: '12px',
            }}
            onClick={handleRetry}
          >
            Retry
          </button>
        </div>
      )}

      {/* Input */}
      <div style={inputContainerStyle}>
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          style={inputStyle}
          disabled={status === 'thinking'}
        />
        <button
          style={{
            ...buttonStyle,
            opacity: !inputValue.trim() || status === 'thinking' ? 0.5 : 1,
            cursor: !inputValue.trim() || status === 'thinking' ? 'not-allowed' : 'pointer',
          }}
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || status === 'thinking'}
        >
          Send
        </button>
      </div>
    </div>
  );
};
