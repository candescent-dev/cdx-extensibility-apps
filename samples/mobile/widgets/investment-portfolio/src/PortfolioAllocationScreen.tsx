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

/** Typical horizontal margin on paper when `scrollable={false}` inside a parent `ScrollView` (host adds no inset). */
const HOSTED_ACCOUNTS_CARD_MARGIN_H = 16;

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US')}`;
}

export interface PortfolioAllocationScreenProps {
  /**
   * When true (default), the screen wraps content in a ScrollView for standalone use (e.g. own tab).
   * Set to false when embedded inside another ScrollView to avoid nested same-direction scrolling.
   */
  scrollable?: boolean;
  /** @deprecated Prefer hosted layout when the parent supplies full width (no outer chrome). Kept for one-off embeds. */
  embedded?: boolean;
  /** Authenticated API client from the embedding app (e.g. Platform SDK). */
  httpClient?: unknown;
  /** Layout widget id / name from host config. */
  name?: string;
  /** Host modal ref for overlays / dismiss when embedded. */
  modalRef?: React.RefObject<unknown | null> | null;
}

export function PortfolioAllocationScreen({
  scrollable = true,
  embedded = false,
  httpClient: _httpClient,
  name: _name,
  modalRef: _modalRef,
}: PortfolioAllocationScreenProps) {
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

  const hostedOnAccountsScroll = !scrollable && !embedded;

  const content = (
    <View
      style={[
        styles.widgetCard,
        embedded && styles.widgetCardEmbedded,
        hostedOnAccountsScroll && styles.widgetCardHostedAccounts,
        { backgroundColor: embedded ? 'transparent' : cardBg },
      ]}
    >
      <View style={[styles.content, embedded && styles.contentEmbedded]}>
        <View style={[styles.welcomeBanner, embedded && styles.welcomeBannerEmbedded]}>
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
        style={[
          embedded ? styles.embeddedScrollHost : styles.root,
          { backgroundColor: embedded ? 'transparent' : bgColor },
        ]}
        contentContainerStyle={[styles.contentContainer, embedded && styles.contentContainerEmbedded]}
        showsVerticalScrollIndicator={false}
      >
        {content}
      </ScrollView>
    );
  }

  /** Embedded in parent scroll: no outer wrapper — gray gutters come from paper `marginHorizontal`. */
  return (
    <View
      style={[
        embedded ? styles.embeddedRoot : styles.hostedRoot,
        { backgroundColor: embedded ? 'transparent' : bgColor },
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  /** Avoid flex:1 when embedded in a parent ScrollView — it can collapse sibling slots to height 0. */
  embeddedRoot: {
    alignSelf: 'stretch',
    width: '100%',
  },
  /** Full width of parent; host scroll typically has no horizontal `contentContainerStyle` pad for extension rows. */
  hostedRoot: {
    alignSelf: 'stretch',
    width: '100%',
  },
  embeddedScrollHost: {
    alignSelf: 'stretch',
    width: '100%',
    flexGrow: 0,
  },
  contentContainer: {
    padding: 16,
    flexGrow: 1,
  },
  contentContainerEmbedded: {
    padding: 0,
    paddingBottom: 4,
    flexGrow: 0,
  },
  widgetCard: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  widgetCardEmbedded: {
    borderRadius: 0,
    overflow: 'visible',
  },
  /** Inset paper on page background; horizontal margin owned by the widget. */
  widgetCardHostedAccounts: {
    marginHorizontal: HOSTED_ACCOUNTS_CARD_MARGIN_H,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  /** Tight padding when using a template-style outer shell (legacy embed). */
  contentEmbedded: {
    padding: 4,
    gap: 8,
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
  welcomeBannerEmbedded: {
    paddingTop: 0,
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
