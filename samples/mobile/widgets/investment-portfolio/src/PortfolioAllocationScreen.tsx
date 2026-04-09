/**
 * PortfolioAllocationScreen -- Investment portfolio widget with branding.
 *
 * Consumes branding through PlatformSDK.getInstance().useBranding().
 * Branding-derived colors are applied to the activity indicator, refresh
 * button, titles, background, and passed to child components (DonutChart,
 * PortfolioLegend) so the entire widget adapts to the active theme.
 */
import * as React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PlatformSDK } from '@cdx-extensions/di-sdk';
import type { MobileBrandingTheme } from '@cdx-extensions/di-sdk-types';

import { DonutChart } from './components/DonutChart';
import { PortfolioLegend } from './components/PortfolioLegend';
import { usePortfolioData } from './hooks/usePortfolioData';
import { useWelcomeUser } from './hooks/useWelcomeUser';

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US')}`;
}

export interface PortfolioAllocationScreenProps {
  /**
   * When true (default), the screen wraps content in a ScrollView for standalone use (e.g. own tab).
   * Set to false when embedded inside another ScrollView to avoid nested same-direction scrolling.
   */
  scrollable?: boolean;
}

export function PortfolioAllocationScreen({ scrollable = true }: PortfolioAllocationScreenProps) {
  const { data, totalValue, refreshKey, isLoading, error, refresh } = usePortfolioData();
  const { userName, isLoading: userLoading } = useWelcomeUser();

  const sdk = React.useMemo(() => PlatformSDK.getInstance(), []);
  const { theme } = sdk.useBranding();
  const t = theme as MobileBrandingTheme | null;

  const primaryColor = t?.colors?.primary?.main ?? '#1A6CDA';
  const bgColor = t?.colors?.background?.default ?? '#f0f0f0';
  const cardBg = t?.colors?.background?.paper ?? '#FFFFFF';
  const textPrimary = t?.colors?.text?.primary ?? '#212121';
  const textSecondary = t?.colors?.text?.secondary ?? '#656565';
  const errorColor = t?.colors?.error?.main ?? '#EF4444';

  const hasData = data != null && totalValue != null;

  const content = (
    <View style={[styles.widgetCard, { backgroundColor: cardBg }]}>
      <View style={styles.content}>
        <View style={styles.welcomeBanner}>
        {userLoading ? (
          <ActivityIndicator size="small" color={primaryColor} />
        ) : userName ? (
          <Text style={[styles.welcomeText, { color: textPrimary }]}>Welcome {userName}</Text>
        ) : null}
        </View>

        <View style={styles.header}>
        <Text style={[styles.title, { color: textPrimary }]}>Portfolio Allocation</Text>
        {hasData && (
          <Pressable
            accessibilityRole="button"
            onPress={refresh}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.refreshButtonPressed,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <>
                <Text style={[styles.refreshIcon, { color: primaryColor }]}>&#x21BB;</Text>
                <Text style={[styles.refreshLabel, { color: primaryColor }]}>Refresh</Text>
              </>
            )}
          </Pressable>
        )}
        </View>

        {error && !hasData ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: errorColor }]}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={refresh}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.retryButton,
                { backgroundColor: primaryColor },
                pressed && styles.retryButtonPressed,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.retryLabel}>Retry</Text>
              )}
            </Pressable>
          </View>
        ) : error && hasData ? (
          <Text style={[styles.errorText, { color: errorColor }]}>{error}</Text>
        ) : null}

        {isLoading && !hasData ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={primaryColor} />
            <Text style={[styles.loaderText, { color: textSecondary }]}>Loading portfolio…</Text>
          </View>
        ) : hasData ? (
          <>
            <View style={styles.chartRow}>
              <DonutChart
                data={data}
                size={200}
                strokeWidth={38}
                animationKey={refreshKey}
                emptyRingColor={t?.colors?.background?.default ?? '#f0f0f0'}
              />
              <View style={styles.balanceInfo}>
                <Text style={[styles.balanceLabel, { color: textSecondary }]}>Total Balance</Text>
                <Text style={[styles.balanceValue, { color: primaryColor }]}>{formatCurrency(totalValue)}</Text>
              </View>
            </View>
            <PortfolioLegend data={data} labelColor={textSecondary} />
          </>
        ) : null}
      </View>
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView
        style={[styles.root, { backgroundColor: bgColor }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {content}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.root, styles.contentContainer, { backgroundColor: bgColor }]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    flexGrow: 1,
  },
  widgetCard: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  content: {
    padding: 20,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 64,
  },
  refreshButtonPressed: {
    opacity: 0.6,
  },
  refreshIcon: {
    fontSize: 18,
  },
  refreshLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  welcomeBanner: {
    paddingTop: 12,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '600',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceInfo: {
    marginLeft: 16,
    gap: 4,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
  },
  balanceValue: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  },
  errorText: {
    fontSize: 13,
    paddingVertical: 4,
  },
  errorContainer: {
    paddingVertical: 16,
    gap: 12,
    alignItems: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  retryButtonPressed: {
    opacity: 0.8,
  },
  retryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loaderContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 14,
  },
});
