import * as React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';

import { AgentChatScreen } from '@cdx-extensions-examples/agent-feature';
import { useHeaderBackToMore } from '../navigation/useHeaderBackToMore';

/** Shared Agent chat UI — used by the Agent chat tab (`AgentScreen`). */
export function AgentChatBody() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <AgentChatScreen />
    </SafeAreaView>
  );
}

/** Bottom-tab Agent chat route — adds “back to More” when opened from the More menu on this tab. */
export function AgentScreen() {
  useHeaderBackToMore('AgentChat');

  return <AgentChatBody />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
