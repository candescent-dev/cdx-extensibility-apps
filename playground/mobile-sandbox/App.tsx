/**
 * Mobile Sandbox entry point.
 *
 * BrandingProvider wraps the entire tree so every screen and widget can
 * call useBranding() / useBrandingContext() and receive the currently
 * selected mock branding. The default mock is 'branding-default'.
 *
 * PlatformSDK.init() wires the harness MobilePlatform as the active
 * platform, so widgets calling PlatformSDK.getInstance().useBranding()
 * get the same context-driven branding.
 *
 * Single-target preview mode:
 *   Set EXPO_PUBLIC_PREVIEW_TARGET to a widget id (WIDGET_REGISTRY) or
 *   feature id (FEATURE_REGISTRY) to bypass the full sandbox tabs and
 *   render just that widget/feature for fast iteration. Example:
 *     EXPO_PUBLIC_PREVIEW_TARGET=investment-portfolio npx nx start mobile-sandbox
 */
import * as React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import Constants from 'expo-constants';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AppTabs } from './navigation/tabs';
import { BrandingPicker } from './navigation/BrandingPicker';
import { getWidgetById } from './registry/WIDGET_REGISTRY';
import {
  getFeatureById,
  TransfersPlaceholderScreen,
  PaymentsPlaceholderScreen,
} from './registry/FEATURE_REGISTRY';
import type { FeatureRegistryItem, MainTabName } from './registry/types';
import { HomeScreen } from './screens/HomeScreen';
import { AgentScreen } from './screens/AgentScreen';

import { PlatformSDK } from '@cdx-extensions/di-sdk';
import { MobilePlatform, BrandingProvider } from '@cdx-extensions/di-sdk-mobile';

import { AddedFeaturesProvider } from './context/AddedFeaturesContext';

PlatformSDK.init({ platform: MobilePlatform.getInstance() });

const TARGET_ALIASES: Record<string, string> = {
  'agent-feature': 'agent-chat',
};

/**
 * Tab screens for features registered with `navigateToTab` (no inline component).
 * Lets preview targets like `agent-chat` or `accounts` render the real tab screen.
 */
const TAB_SCREENS: Record<MainTabName, React.ComponentType | undefined> = {
  Accounts: HomeScreen,
  AgentChat: AgentScreen,
  Transfers: TransfersPlaceholderScreen,
  Payments: PaymentsPlaceholderScreen,
  More: undefined,
};

function hasComponent(
  f: FeatureRegistryItem,
): f is Extract<FeatureRegistryItem, { component: React.ComponentType }> {
  return 'component' in f && f.component != null;
}

function getTabScreenForFeature(f: FeatureRegistryItem): React.ComponentType | undefined {
  if (f.navigateToTab) return TAB_SCREENS[f.navigateToTab];
  return undefined;
}

function resolvePreviewTarget(): string | undefined {
  // `EXPO_PUBLIC_*` is inlined when Metro starts (see `run-with-preview.mjs`). Rely on it first so
  // preview mode does not silently fall back to the full tab shell (default tab is often the
  // investment-portfolio widget).
  const fromEnv =
    typeof process.env.EXPO_PUBLIC_PREVIEW_TARGET === 'string'
      ? process.env.EXPO_PUBLIC_PREVIEW_TARGET
      : '';
  const fromExtra = (Constants.expoConfig?.extra as { previewTarget?: string } | undefined)
    ?.previewTarget;
  return (fromEnv || fromExtra || '').trim() || undefined;
}

function PreviewBody({ target }: { target: string }) {
  const normalized = TARGET_ALIASES[target] ?? target;

  const widget = getWidgetById(normalized);
  if (widget) {
    const C = widget.component;
    return <C scrollable />;
  }

  const feature = getFeatureById(normalized);
  if (feature) {
    if (hasComponent(feature)) {
      const C = feature.component;
      return <C />;
    }
    const Tab = getTabScreenForFeature(feature);
    if (Tab) return <Tab />;
  }

  return (
    <View style={previewStyles.fallback}>
      <Text style={previewStyles.fallbackTitle}>Unknown preview target</Text>
      <Text style={previewStyles.fallbackBody}>
        {`Got "${target}". Set EXPO_PUBLIC_PREVIEW_TARGET to a widget id (WIDGET_REGISTRY) or feature id (FEATURE_REGISTRY).`}
      </Text>
    </View>
  );
}

function PreviewRoot({ target }: { target: string }) {
  return (
    <View style={previewStyles.root}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView edges={['top']} style={previewStyles.chromeSafe}>
        <View style={previewStyles.chrome}>
          <Text style={previewStyles.chromeTitle}>Preview</Text>
          <BrandingPicker />
        </View>
      </SafeAreaView>
      <PreviewBody target={target} />
    </View>
  );
}

export default function App() {
  const previewTarget = resolvePreviewTarget();

  return (
    <BrandingProvider>
      <AddedFeaturesProvider>
        <SafeAreaProvider>
          {previewTarget ? (
            <PreviewRoot target={previewTarget} />
          ) : (
            <NavigationContainer>
              <AppTabs />
            </NavigationContainer>
          )}
        </SafeAreaProvider>
      </AddedFeaturesProvider>
    </BrandingProvider>
  );
}

const previewStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  chromeSafe: { backgroundColor: '#fff' },
  chrome: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  chromeTitle: { fontSize: 17, fontWeight: '700' },
  fallback: { flex: 1, padding: 24, justifyContent: 'center' },
  fallbackTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  fallbackBody: { fontSize: 14, color: '#555', lineHeight: 20 },
});
