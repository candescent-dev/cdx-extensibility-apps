/**
 * TypingIndicator - React Native (animated dots)
 *
 * Consumes branding-resolved colors passed from ChatInterface.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { ResolvedColors } from '../types/branding';
import { SPACING } from '../types/branding';

interface TypingIndicatorProps {
  colors: ResolvedColors;
}

export function TypingIndicator({ colors }: TypingIndicatorProps) {
  const a1 = useRef(new Animated.Value(0)).current;
  const a2 = useRef(new Animated.Value(0)).current;
  const a3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: -8,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ])
      );
    };
    const st1 = animate(a1, 0);
    const st2 = animate(a2, 150);
    const st3 = animate(a3, 300);
    st1.start();
    st2.start();
    st3.start();
    return () => {
      st1.stop();
      st2.stop();
      st3.stop();
    };
  }, [a1, a2, a3]);

  return (
    <View
      style={[
        styles.container,
        {
          padding: SPACING.medium,
          marginBottom: SPACING.small,
          backgroundColor: colors.surface,
          borderRadius: 12,
          alignSelf: 'flex-start',
        },
      ]}
    >
      <View style={styles.dots}>
        <Animated.View
          style={[
            styles.dot,
            {
              backgroundColor: colors.textSecondary,
              transform: [{ translateY: a1 }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            {
              backgroundColor: colors.textSecondary,
              transform: [{ translateY: a2 }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            {
              backgroundColor: colors.textSecondary,
              transform: [{ translateY: a3 }],
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
