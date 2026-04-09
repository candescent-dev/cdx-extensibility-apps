/**
 * Agent Chat Screen - React Native (Bring Your Own Agent)
 *
 * Consumes branding through PlatformSDK.getInstance().useBranding().
 * Branding-derived colors are applied to the activity indicator, titles,
 * background, info box, and passed to ChatInterface so the entire feature
 * adapts to the active theme.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { PlatformSDK } from '@cdx-extensions/di-sdk';
import type { MobileBrandingTheme } from '@cdx-extensions/di-sdk-types';
import { ChatInterface } from './components/ChatInterface';
import { agentService } from './services/agentService';
import { resolveColors, SPACING } from './types/branding';

export function AgentChatScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sdk = React.useMemo(() => {
    return PlatformSDK.getInstance();
  }, []);

  const { theme } = sdk.useBranding();
  const t = theme as MobileBrandingTheme | null;
  const colors = resolveColors(t);

  const userContextResult: { data?: { fullName?: string }; isLoading?: boolean; error?: unknown } =
    sdk.useUserContext?.() ?? {};
  const userContextData = userContextResult?.data;

  useEffect(() => {
    if (userContextData) {
      agentService.setUserContext({
        fullName: userContextData.fullName,
        guid: (userContextData as { guid?: string })?.guid,
        email: (userContextData as { email?: string })?.email,
        userName: (userContextData as { userName?: string })?.userName,
      });
    }
  }, [userContextData]);

  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading agent...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, styles.errorContainer]}>
        <Text style={[styles.errorTitle, { color: colors.text }]}>Error</Text>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      </View>
    );
  }

  const welcomeSection = (
    <View style={[styles.topSection, { paddingVertical: SPACING.large }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Bring Your Own Agent
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: colors.textSecondary, marginBottom: SPACING.small },
          ]}
        >
          AI-powered assistant integrated with your platform
        </Text>
      </View>
      <View
        style={[
          styles.infoBox,
          {
            padding: SPACING.medium,
            backgroundColor: colors.surface,
            borderRadius: 8,
          },
        ]}
      >
        <Text
          style={[
            styles.infoText,
            { fontSize: 14, color: colors.textSecondary },
          ]}
        >
          <Text style={styles.infoBold}>
            Welcome, {userContextData?.fullName ?? 'User'}!
          </Text>
          {' '}
          The agent has access to your user context and can provide personalized assistance.
        </Text>
      </View>
    </View>
  );

  const aboutSection = (
    <View
      style={[
        styles.aboutBox,
        {
          marginTop: SPACING.large,
          padding: SPACING.medium,
          backgroundColor: colors.surface,
          borderRadius: 8,
        },
      ]}
    >
      <Text
        style={[
          styles.aboutTitle,
          {
            marginBottom: SPACING.small,
            color: colors.text,
          },
        ]}
      >
        About This Example
      </Text>
      <Text style={[styles.aboutList, { color: colors.textSecondary, fontSize: 14 }]}>
        • All API calls go through the platform's httpClient for security{'\n'}
        • User context is automatically passed to the agent{'\n'}
        • Messages are authenticated and validated by the platform{'\n'}
        • Agent responses are rendered with custom branding{'\n'}
        • Supports conversation history and retry logic
      </Text>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.chatWrapper}>
        <ChatInterface
          colors={colors}
          topContent={welcomeSection}
          footer={aboutSection}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topSection: { paddingBottom: 8 },
  chatWrapper: { flex: 1, minHeight: 0 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: { marginTop: 12, fontSize: 16 },
  errorContainer: {},
  errorTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  errorText: { textAlign: 'center' },
  header: { marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '600', marginBottom: 8 },
  subtitle: { fontSize: 16 },
  infoBox: {},
  infoText: {},
  infoBold: { fontWeight: '700' },
  aboutBox: {},
  aboutTitle: { fontSize: 16, fontWeight: '600' },
  aboutList: {},
});
