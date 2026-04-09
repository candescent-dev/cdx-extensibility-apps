import * as React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';

import { AgentChatScreen } from '@cdx-extensions-examples/agent-feature';

export function AgentScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <AgentChatScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
