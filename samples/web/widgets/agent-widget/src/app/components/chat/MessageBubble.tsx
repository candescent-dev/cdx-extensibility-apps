/**
 * MessageBubble Component
 *
 * Displays individual messages in the chat interface
 */

import React from 'react';
import type { Message } from '../types/agent';
import type { BrandingConfig } from '../types/branding';
import { defaultBranding } from '../types/branding';

interface MessageBubbleProps {
  message: Message;
  branding: BrandingConfig;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, branding }) => {
  const isUser = message.role === 'user';

  // Use provided branding or fallback to default
  const effectiveBranding = branding || defaultBranding;

  const bubbleStyle: React.CSSProperties = {
    maxWidth: '70%',
    padding: effectiveBranding.spacing.medium,
    borderRadius: '12px',
    marginBottom: effectiveBranding.spacing.small,
    alignSelf: isUser ? 'flex-end' : 'flex-start',
    backgroundColor: isUser ? effectiveBranding.colors.primary : effectiveBranding.colors.surface,
    color: isUser ? '#ffffff' : effectiveBranding.colors.text,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  };

  const metaStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    opacity: 0.7,
    marginTop: effectiveBranding.spacing.small / 2,
    fontFamily: effectiveBranding.fonts.secondary,
  };

  const formatTime = (date: Date): string => {
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={bubbleStyle}>
      <div style={{ fontFamily: effectiveBranding.fonts.primary, lineHeight: 1.5 }}>{message.content}</div>
      <div style={metaStyle}>
        {formatTime(message.timestamp)}
        {message.metadata?.model && ` • ${message.metadata.model}`}
        {message.metadata?.tokens && ` • ${message.metadata.tokens} tokens`}
      </div>
      {message.metadata?.suggestedActions && message.metadata.suggestedActions.length > 0 && (
        <div style={{ marginTop: effectiveBranding.spacing.small }}>
          {message.metadata.suggestedActions.map((action, idx) => (
            <button
              key={idx}
              style={{
                padding: `${effectiveBranding.spacing.small}px ${effectiveBranding.spacing.medium}px`,
                marginRight: effectiveBranding.spacing.small,
                marginTop: effectiveBranding.spacing.small,
                backgroundColor: '#ffffff',
                color: effectiveBranding.colors.primary,
                border: `1px solid ${effectiveBranding.colors.primary}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontFamily: effectiveBranding.fonts.primary,
                fontSize: '0.875rem',
              }}
              onClick={() => {
                // eslint-disable-next-line no-console
                console.log('Suggested action clicked:', action);
                // Handle action based on type
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
