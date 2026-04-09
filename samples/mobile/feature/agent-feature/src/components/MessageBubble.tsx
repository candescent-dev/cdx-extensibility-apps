/**
 * MessageBubble - React Native
 *
 * Consumes branding-resolved colors passed from ChatInterface.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Message } from '../types/agent';
import type { ResolvedColors } from '../types/branding';
import { SPACING } from '../types/branding';

interface MessageBubbleProps {
  message: Message;
  colors: ResolvedColors;
}

export function MessageBubble({ message, colors }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  const formatTime = (date: Date): string => {
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View
      style={[
        styles.bubble,
        {
          alignSelf: isUser ? 'flex-end' : 'flex-start',
          backgroundColor: isUser ? colors.primary : colors.surface,
          padding: SPACING.medium,
          marginBottom: SPACING.small,
          borderRadius: 12,
        },
      ]}
    >
      <Text
        style={[
          styles.content,
          {
            color: isUser ? colors.primaryContrast : colors.text,
          },
        ]}
      >
        {message.content}
      </Text>
      <Text
        style={[
          styles.meta,
          {
            color: isUser ? 'rgba(255,255,255,0.8)' : colors.textSecondary,
            marginTop: SPACING.small / 2,
          },
        ]}
      >
        {formatTime(message.timestamp)}
        {message.metadata?.model && ` • ${message.metadata.model}`}
        {message.metadata?.tokens != null && ` • ${message.metadata.tokens} tokens`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '78%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
  },
  meta: {
    fontSize: 11,
  },
});
