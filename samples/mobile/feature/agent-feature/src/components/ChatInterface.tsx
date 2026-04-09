/**
 * ChatInterface - React Native
 *
 * Consumes branding-resolved colors passed from AgentChatScreen.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  InteractionManager,
  Keyboard,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { agentService } from '../services/agentService';
import type { Message, AgentStatus, AgentError } from '../types/agent';
import type { ResolvedColors } from '../types/branding';
import { SPACING } from '../types/branding';

interface ChatInterfaceProps {
  colors: ResolvedColors;
  topContent?: React.ReactNode;
  footer?: React.ReactNode;
}

export function ChatInterface({
  colors,
  topContent,
  footer,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [error, setError] = useState<AgentError | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const pendingScrollTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const topContentHeightRef = useRef(0);
  const messagesLengthRef = useRef(0);
  messagesLengthRef.current = messages.length;

  const clearScheduledScrolls = useCallback(() => {
    pendingScrollTimeoutsRef.current.forEach((id) => clearTimeout(id));
    pendingScrollTimeoutsRef.current = [];
  }, []);

  const flushScrollToEnd = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, []);

  /** Host apps often lay out after the first paint; retry scroll so the latest bubble stays visible. */
  const scheduleScrollToEnd = useCallback(() => {
    clearScheduledScrolls();
    flushScrollToEnd();
    requestAnimationFrame(() => {
      flushScrollToEnd();
      requestAnimationFrame(() => {
        flushScrollToEnd();
      });
    });
    InteractionManager.runAfterInteractions(() => {
      flushScrollToEnd();
    });
    for (const ms of [50, 150, 350]) {
      pendingScrollTimeoutsRef.current.push(setTimeout(flushScrollToEnd, ms));
    }
  }, [clearScheduledScrolls, flushScrollToEnd]);

  useEffect(() => () => clearScheduledScrolls(), [clearScheduledScrolls]);

  const containerRef = useRef<View>(null);
  const containerBottomYRef = useRef(0);
  const handleContainerLayout = useCallback(() => {
    containerRef.current?.measureInWindow((_x, y, _w, h) => {
      containerBottomYRef.current = y + h;
    });
  }, []);

  /**
   * Animated bottom inset so the input stays above the keyboard.
   * - iOS: keyboardWillShow/Hide + overlap after measureInWindow (synced duration with keyboard).
   * - Android: keyboardDidShow/Hide + min(overlap, keyboardHeight). If the host uses adjustResize,
   *   the container bottom is already above the keyboard (overlap <= 0) so inset stays 0 — no double gap.
   *   If the host cannot change windowSoftInputMode, overlap > 0 and we pad by the needed amount.
   */
  const bottomInsetAnim = useRef(new Animated.Value(0)).current;
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const getIosKeyboardDuration = useCallback((e: { duration?: number }) => {
    return typeof e.duration === 'number' && e.duration > 0 ? e.duration : 250;
  }, []);

  useEffect(() => {
    const animateInset = (toValue: number, duration: number) => {
      Animated.timing(bottomInsetAnim, {
        toValue,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    };

    if (Platform.OS === 'ios') {
      const showSub = Keyboard.addListener('keyboardWillShow', (e) => {
        setKeyboardVisible(true);
        const keyboardTop = e.endCoordinates.screenY;
        const duration = getIosKeyboardDuration(e);
        const applyInset = () => {
          containerRef.current?.measureInWindow((_x, y, _w, h) => {
            containerBottomYRef.current = y + h;
            const overlap = containerBottomYRef.current - keyboardTop;
            animateInset(Math.max(0, overlap), duration);
          });
        };
        requestAnimationFrame(applyInset);
      });
      const hideSub = Keyboard.addListener('keyboardWillHide', (e) => {
        setKeyboardVisible(false);
        animateInset(0, getIosKeyboardDuration(e));
      });
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }

    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardVisible(true);
      const keyboardTop = e.endCoordinates.screenY;
      const keyboardHeight = e.endCoordinates.height;
      const applyInset = () => {
        containerRef.current?.measureInWindow((_x, y, _w, h) => {
          const bottom = y + h;
          const overlap = bottom - keyboardTop;
          if (overlap <= 0 || keyboardHeight <= 0) {
            animateInset(0, 200);
          } else {
            animateInset(Math.min(overlap, keyboardHeight), 260);
          }
        });
      };
      requestAnimationFrame(applyInset);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      animateInset(0, 220);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [bottomInsetAnim, getIosKeyboardDuration]);

  useEffect(() => {
    if (keyboardVisible) {
      if (aboutExpandedRef.current) {
        runAboutAnimationRef.current(0);
      }
      const t = setTimeout(() => scheduleScrollToEnd(), 150);
      return () => clearTimeout(t);
    }
  }, [keyboardVisible, scheduleScrollToEnd]);

  const ABOUT_PANEL_MAX_HEIGHT = 280;
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const aboutExpandedRef = useRef(false);
  aboutExpandedRef.current = aboutExpanded;
  const aboutHeightAnim = useRef(new Animated.Value(0)).current;
  const aboutHeightRef = useRef(0);
  useEffect(() => {
    const listenerId = aboutHeightAnim.addListener(({ value }) => {
      aboutHeightRef.current = value;
    });
    return () => aboutHeightAnim.removeListener(listenerId);
  }, [aboutHeightAnim]);
  const aboutDragStart = useRef(0);

  const runAboutAnimationRef = useRef<(target: number) => void>(() => {});
  const runAboutAnimation = useCallback(
    (target: number) => {
      aboutHeightAnim.stopAnimation((currentValue) => {
        aboutHeightAnim.setValue(currentValue);
        setAboutExpanded(target > 0);
        if (target === 0) {
          Animated.timing(aboutHeightAnim, {
            toValue: 0,
            duration: 280,
            useNativeDriver: false,
            easing: Easing.out(Easing.cubic),
          }).start();
        } else {
          Animated.spring(aboutHeightAnim, {
            toValue: target,
            useNativeDriver: false,
            tension: 65,
            friction: 11,
          }).start();
        }
      });
    },
    [aboutHeightAnim]
  );
  runAboutAnimationRef.current = runAboutAnimation;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => {
        aboutDragStart.current = aboutHeightRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const next = Math.max(0, Math.min(ABOUT_PANEL_MAX_HEIGHT, aboutDragStart.current + gestureState.dy));
        aboutHeightAnim.setValue(next);
      },
      onPanResponderRelease: (_, gestureState) => {
        const current = aboutDragStart.current + gestureState.dy;
        const velocity = gestureState.vy;
        const movedLittle = Math.abs(gestureState.dy) < 10;
        const currentlyExpanded = movedLittle
          ? aboutExpandedRef.current
          : aboutHeightRef.current > ABOUT_PANEL_MAX_HEIGHT / 2;
        const shouldExpand = movedLittle
          ? !currentlyExpanded
          : velocity > 0.3 || (velocity >= -0.3 && current > ABOUT_PANEL_MAX_HEIGHT / 2);
        const target = shouldExpand ? ABOUT_PANEL_MAX_HEIGHT : 0;
        runAboutAnimationRef.current(target);
      },
    })
  ).current;

  useEffect(() => {
    const init = async () => {
      try {
        await agentService.initialize();
        const welcome: Message = {
          id: 'welcome',
          role: 'agent',
          content: "Hello! I'm your AI assistant. How can I help you today?",
          timestamp: new Date(),
        };
        setMessages([welcome]);
      } catch (err) {
        setError({
          code: 'INIT_ERROR',
          message: 'Failed to initialize agent service',
          retryable: true,
        });
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (messages.length > 1) {
      scheduleScrollToEnd();
    }
  }, [messages, status, scheduleScrollToEnd]);

  const lastContentHeightRef = useRef(0);
  const handleContentSizeChange = useCallback(
    (_w: number, h: number) => {
      const prev = lastContentHeightRef.current;
      lastContentHeightRef.current = h;
      if (messagesLengthRef.current > 0 && h > prev) {
        scheduleScrollToEnd();
      }
    },
    [scheduleScrollToEnd]
  );

  const handleTopContentLayout = useCallback((e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    topContentHeightRef.current = height;
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || status === 'thinking') return;
    const userMessageText = inputValue.trim();
    setInputValue('');
    setError(null);
    setStatus('thinking');

    const userMessage: Message = {
      id: `temp_${Date.now()}`,
      role: 'user',
      content: userMessageText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const agentMessage = await agentService.sendMessage(userMessageText);
      setMessages((prev) => [...prev, agentMessage]);
      setStatus('idle');
    } catch (err: unknown) {
      const e = err as AgentError;
      setError(e);
      setStatus('error');
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: 'agent',
        content: `Sorry, I encountered an error: ${e.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  }, [inputValue, status]);

  const handleRetry = useCallback(async () => {
    setError(null);
    setStatus('thinking');
    try {
      const agentMessage = await agentService.retryLastMessage();
      setMessages((prev) => {
        const filtered = prev.filter((msg) => !msg.id.startsWith('error_'));
        return [...filtered, agentMessage];
      });
      setStatus('idle');
    } catch (err: unknown) {
      setError(err as AgentError);
      setStatus('error');
    }
  }, []);

  const handleClearChat = useCallback(() => {
    agentService.clearConversation();
    setMessages([]);
    setError(null);
    setStatus('idle');
    const welcome: Message = {
      id: 'welcome',
      role: 'agent',
      content: 'Chat cleared. How can I help you?',
      timestamp: new Date(),
    };
    setMessages([welcome]);
  }, []);

  const statusLabel =
    status === 'thinking'
      ? 'Thinking...'
      : status === 'error'
        ? 'Error - Please retry'
        : 'Ready';

  const inputRow = (
    <View
      style={[
        styles.inputRow,
        {
          padding: SPACING.medium,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          gap: SPACING.small,
        },
      ]}
    >
      <TextInput
        style={[
          styles.input,
          {
            padding: SPACING.medium,
            borderColor: colors.border,
            backgroundColor: colors.background,
            borderRadius: 20,
            fontSize: 14,
          },
        ]}
        value={inputValue}
        onChangeText={setInputValue}
        placeholder="Type your message..."
        placeholderTextColor={colors.textSecondary}
        editable={status !== 'thinking'}
        onSubmitEditing={handleSendMessage}
        returnKeyType="send"
      />
      <Pressable
        onPress={handleSendMessage}
        disabled={!inputValue.trim() || status === 'thinking'}
        style={({ pressed }) => [
          styles.sendButton,
          {
            paddingVertical: SPACING.small,
            paddingHorizontal: SPACING.medium,
            backgroundColor: colors.primary,
            borderRadius: 20,
            opacity:
              !inputValue.trim() || status === 'thinking' ? 0.5 : pressed ? 0.9 : 1,
          },
        ]}
        accessibilityRole="button"
      >
        <Text style={[styles.sendButtonText, { color: colors.primaryContrast }]}>Send</Text>
      </Pressable>
    </View>
  );

  const aiHeaderBlock = (
    <View
      style={[
        styles.header,
        {
          padding: SPACING.medium,
          backgroundColor: colors.primary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          marginBottom: SPACING.small,
        },
      ]}
    >
      <View>
        <Text style={[styles.headerTitle, { color: colors.primaryContrast }]}>AI Assistant</Text>
        <Text style={[styles.headerStatus, { color: colors.primaryContrast, opacity: 0.9 }]}>
          {statusLabel}
        </Text>
      </View>
      <Pressable
        onPress={handleClearChat}
        style={({ pressed }) => [
          styles.clearButton,
          { borderColor: colors.primaryContrast },
          pressed && styles.clearButtonPressed,
        ]}
        accessibilityRole="button"
      >
        <Text style={[styles.clearButtonText, { color: colors.primaryContrast }]}>Clear Chat</Text>
      </Pressable>
    </View>
  );

  return (
    <Animated.View
      ref={containerRef}
      onLayout={handleContainerLayout}
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderRadius: 8,
          overflow: 'hidden',
          paddingBottom: bottomInsetAnim,
        },
      ]}
    >
        <ScrollView
          ref={scrollRef}
          style={[
            styles.messagesContainer,
            {
              padding: SPACING.medium,
              backgroundColor: colors.background,
            },
          ]}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          nestedScrollEnabled
          onContentSizeChange={handleContentSizeChange}
        >
          {topContent != null ? (
            <View onLayout={handleTopContentLayout}>{topContent}</View>
          ) : null}
          {aiHeaderBlock}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              colors={colors}
            />
          ))}
          {status === 'thinking' && (
            <TypingIndicator colors={colors} />
          )}
        </ScrollView>

        {error?.retryable && (
          <View
            style={[
              styles.errorBanner,
              {
                padding: SPACING.small,
                backgroundColor: colors.error,
              },
            ]}
          >
            <Text style={styles.errorText}>{error.message}</Text>
            <Pressable
              onPress={handleRetry}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && { opacity: 0.9 },
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.retryButtonText, { color: colors.error }]}>Retry</Text>
            </Pressable>
          </View>
        )}

        {inputRow}

        {footer != null && !keyboardVisible ? (
          <View style={styles.aboutDrawer}>
            <View
              style={[
                styles.aboutDragHandle,
                {
                  backgroundColor: colors.surface,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                },
              ]}
              {...panResponder.panHandlers}
            >
              <View style={styles.aboutDragHandleBar} />
              <Text
                style={[
                  styles.aboutDragHandleLabel,
                  { color: colors.textSecondary },
                ]}
              >
                About this example
              </Text>
            </View>
            <Animated.View
              style={[
                styles.aboutPanelContent,
                {
                  backgroundColor: colors.surface,
                  overflow: 'hidden',
                  height: aboutHeightAnim,
                },
              ]}
            >
              <ScrollView
                style={styles.aboutPanelScroll}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {footer}
              </ScrollView>
            </Animated.View>
          </View>
        ) : null}
      </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerStatus: {
    fontSize: 12,
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  clearButtonPressed: {
    opacity: 0.9,
  },
  clearButtonText: {
    fontSize: 12,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#ffffff',
  },
  retryButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderRadius: 4,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
  },
  sendButton: {},
  sendButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  aboutDrawer: {
    alignSelf: 'stretch',
  },
  aboutDragHandle: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutDragHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginBottom: 4,
  },
  aboutDragHandleLabel: {
    fontSize: 12,
  },
  aboutPanelContent: {
    maxHeight: 280,
  },
  aboutPanelScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
  },
});
