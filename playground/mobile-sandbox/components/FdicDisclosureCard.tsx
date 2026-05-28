import * as React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';

/** MBA remote-logo spec (dp); scaled up so the sandbox wordmark reads bolder / larger. */
const FDIC_WORDMARK_BASE_W = 37.36;
const FDIC_WORDMARK_BASE_H = 15.74;
const FDIC_WORDMARK_SCALE = 1.55;
const FDIC_WORDMARK_WIDTH = FDIC_WORDMARK_BASE_W * FDIC_WORDMARK_SCALE;
const FDIC_WORDMARK_HEIGHT = FDIC_WORDMARK_BASE_H * FDIC_WORDMARK_SCALE;

/** Vector wordmark — fills the frame for a heavy, logo-like weight. */
function FdicWordmark({ color }: { color: string }) {
  const w = FDIC_WORDMARK_WIDTH;
  const h = FDIC_WORDMARK_HEIGHT;
  const fontSize = h * 0.97;
  const baselineY = h * 0.805;

  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} accessibilityRole="image" accessibilityLabel="FDIC">
      <SvgText
        x="0"
        y={baselineY}
        fill={color}
        fontSize={fontSize}
        fontWeight={Platform.select({ ios: '700', default: '900' })}
        letterSpacing={-0.7}
        fontFamily={Platform.select({
          ios: 'HelveticaNeue-Bold',
          android: 'sans-serif',
        })}
      >
        FDIC
      </SvgText>
    </Svg>
  );
}

/**
 * Sample deposit-insurance disclosure row (layout demo for the sandbox).
 */
export function FdicDisclosureCard({
  borderColor,
  backgroundColor,
  markColor,
  copyColor,
}: {
  borderColor: string;
  backgroundColor: string;
  markColor: string;
  copyColor: string;
}) {
  return (
    <View style={[styles.card, { borderColor, backgroundColor }]}>
      <View style={styles.markSlot}>
        <FdicWordmark color={markColor} />
      </View>
      <View style={styles.copyWrap}>
        <Text style={[styles.copy, { color: copyColor }]}>
          FDIC-Insured—Backed by the full faith and credit of
        </Text>
        <Text style={[styles.copy, { color: copyColor }]}>the U.S. Government</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  markSlot: {
    width: FDIC_WORDMARK_WIDTH,
    height: FDIC_WORDMARK_HEIGHT,
    justifyContent: 'center',
  },
  copyWrap: { flex: 1, minWidth: 0 },
  copy: {
    fontSize: 12.8,
    lineHeight: 16.5,
    fontStyle: 'italic',
    letterSpacing: -0.006,
  },
});
