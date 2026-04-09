import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

import type { PortfolioItem } from '../types';

interface DonutChartProps {
  data: PortfolioItem[];
  size?: number;
  strokeWidth?: number;
  animationKey?: number;
  /** Color for the empty (background) ring -- driven by branding background color */
  emptyRingColor?: string;
}

const ANIMATION_DURATION_MS = 700;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function createArcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`,
  ].join(' ');
}

export function DonutChart({
  data,
  size = 200,
  strokeWidth = 36,
  animationKey = 0,
  emptyRingColor = '#f0f0f0',
}: DonutChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - strokeWidth) / 2;

  const rafRef = useRef<number>();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    const start = Date.now();

    const step = () => {
      const t = Math.min((Date.now() - start) / ANIMATION_DURATION_MS, 1);
      setProgress(easeOutCubic(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [animationKey]);

  const visibleData = useMemo(
    () => (data ?? []).filter((item) => item.percentage > 0),
    [data],
  );

  const totalAngle = 360 * progress;

  const arcs = useMemo(() => {
    let cumulative = 0;
    const result: Array<PortfolioItem & { startAngle: number; endAngle: number }> = [];

    for (const item of visibleData) {
      const rawStart = cumulative * 3.6;
      cumulative += item.percentage;
      const rawEnd = cumulative * 3.6;

      const clampedStart = Math.min(rawStart, totalAngle);
      const clampedEnd = Math.min(rawEnd, totalAngle);

      if (clampedEnd - clampedStart > 0.1) {
        result.push({ ...item, startAngle: clampedStart, endAngle: clampedEnd });
      }
    }

    return result;
  }, [visibleData, totalAngle]);

  if (visibleData.length === 0) {
    return (
      <View style={[styles.container, styles.empty, { width: size, height: size }]}>
        <Text style={styles.emptyText}>No allocation data</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={emptyRingColor}
          strokeWidth={strokeWidth}
        />
        {arcs.map((arc) => (
          <Path
            key={arc.id}
            d={createArcPath(cx, cy, radius, arc.startAngle, arc.endAngle)}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    backgroundColor: '#f8f9fa',
    borderRadius: 999,
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
  },
});
