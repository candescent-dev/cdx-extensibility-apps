import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import type { PortfolioItem } from '../types';

interface LegendItemProps {
  item: PortfolioItem;
  /** Text color for the asset label -- driven by branding text.secondary */
  labelColor?: string;
}

export function LegendItem({ item, labelColor }: LegendItemProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: item.color }]} />
      <Text style={[styles.percentage, { color: item.color }]}>
        {item.percentage}%
      </Text>
      <Text style={[styles.label, { color: labelColor ?? '#656565' }]}>
        {item.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 99,
  },
  percentage: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 30,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
});
