import * as React from 'react';
import { View, StyleSheet } from 'react-native';

import type { PortfolioItem } from '../types';
import { LegendItem } from './LegendItem';

interface PortfolioLegendProps {
  data: PortfolioItem[];
  labelColor?: string;
}

export function PortfolioLegend({ data, labelColor }: PortfolioLegendProps) {
  const midpoint = Math.ceil(data.length / 2);
  const leftColumn = data.slice(0, midpoint);
  const rightColumn = data.slice(midpoint);

  return (
    <View style={styles.container}>
      <View style={styles.column}>
        {leftColumn.map((item) => (
          <LegendItem key={item.id} item={item} labelColor={labelColor} />
        ))}
      </View>
      {rightColumn.length > 0 && (
        <View style={styles.column}>
          {rightColumn.map((item) => (
            <LegendItem key={item.id} item={item} labelColor={labelColor} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    columnGap: 12,
  },
  column: {
    flex: 1,
    gap: 8,
  },
});
