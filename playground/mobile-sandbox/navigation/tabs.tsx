import * as React from 'react';
import {
  Text,
  TouchableOpacity,
  Modal,
  View,
  StyleSheet,
  Pressable,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useBrandingContext } from '@cdx-extensions/di-sdk-mobile';

import { WidgetsScreen } from '../screens/WidgetsScreen';
import { AgentScreen } from '../screens/AgentScreen';

type TabConfig = {
  name: string;
  label: string;
  component: React.ComponentType;
  icon: string;
};

const TAB_SCREENS: TabConfig[] = [
  { name: 'Widgets', label: 'Widget Example', component: WidgetsScreen, icon: '⊞' },
  { name: 'AgentChat', label: 'Agent Chat', component: AgentScreen, icon: '💬' },
];

const Tab = createBottomTabNavigator();

function BrandingPicker() {
  const [visible, setVisible] = React.useState(false);
  const { brandingId, setBrandingId, availableBrandings, theme } =
    useBrandingContext();

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={styles.headerButton}
        hitSlop={8}
      >
        <Text style={[styles.headerIcon, { color: theme.colors.text.primary }]}>⚙</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>Theme</Text>
            {availableBrandings.map((branding) => {
              const isActive = branding.id === brandingId;
              return (
                <TouchableOpacity
                  key={branding.id}
                  style={[styles.menuItem, isActive && styles.menuItemActive]}
                  onPress={() => {
                    setBrandingId(branding.id);
                    setVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.menuItemText,
                      isActive && styles.menuItemTextActive,
                    ]}
                  >
                    {branding.name}
                  </Text>
                  {isActive && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export function AppTabs() {
  return (
    <Tab.Navigator
      id="MainTabs"
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        headerRight: () => <BrandingPicker />,
      }}
    >
      {TAB_SCREENS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            title: tab.label,
            tabBarIcon: ({ color, size }) => (
              <Text style={{ fontSize: size, color }}>{tab.icon}</Text>
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    marginRight: 16,
    padding: 4,
  },
  headerIcon: {
    fontSize: 22,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 16,
  },
  menu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemActive: {
    backgroundColor: '#F2F2F7',
  },
  menuItemText: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  menuItemTextActive: {
    fontWeight: '600',
    color: '#007AFF',
  },
  checkmark: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '700',
    marginLeft: 12,
  },
});
