import * as React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/HomeScreen';
import { AgentScreen } from '../screens/AgentScreen';
import {
  TransfersPlaceholderScreen,
  PaymentsPlaceholderScreen,
} from '../registry/FEATURE_REGISTRY';
import { MoreNavigator } from './MoreNavigator';
import { BrandingPicker, BrandingPickerHeaderSettingsTrigger } from './BrandingPicker';
import type { RootTabParamList } from './types';
import { SandboxMaterialIcon } from '../icons/SandboxMaterialIcon';
import { SANDBOX_ICON_SIZE } from '../icons/iconSizes';
import { useBrandingContext } from '@cdx-extensions/di-sdk-mobile';
import { brandingUiColors } from '../utils/brandingUiColors';
import { useHeaderBackToMore } from './useHeaderBackToMore';

const Tab = createBottomTabNavigator<RootTabParamList>();

/** Content row height only; safe-area inset is added below for the home indicator / gesture bar. */
const TAB_BAR_BASE_HEIGHT = Platform.OS === 'ios' ? 52 : 58;

function TransfersTabScreen() {
  useHeaderBackToMore('Transfers');
  return <TransfersPlaceholderScreen />;
}

function PaymentsTabScreen() {
  useHeaderBackToMore('Payments');
  return <PaymentsPlaceholderScreen />;
}

export function AppTabs() {
  const { theme } = useBrandingContext();
  const ui = brandingUiColors(theme);
  const insets = useSafeAreaInsets();
  const tabBarBottomInset = insets.bottom;

  const tabBarStyle = React.useMemo(
    () => ({
      backgroundColor: ui.tabBarBg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: ui.borderColor,
      paddingTop: 6,
      paddingBottom: tabBarBottomInset,
      height: TAB_BAR_BASE_HEIGHT + tabBarBottomInset,
    }),
    [ui.borderColor, ui.tabBarBg, tabBarBottomInset],
  );

  /** Matches the leading-cluster header on Home (`SandboxAppHeader`): single settings glyph. */
  const headerRight = React.useCallback(
    () => (
      <BrandingPicker
        trigger={(open) => (
          <BrandingPickerHeaderSettingsTrigger
            onOpen={open}
            iconColor={ui.headerForegroundColor}
            style={styles.headerPickerHit}
          />
        )}
      />
    ),
    [ui.headerForegroundColor],
  );

  return (
    <Tab.Navigator
      id="MainTabs"
      initialRouteName="Accounts"
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: ui.headerBarBg },
        headerShadowVisible: false,
        headerTitleStyle: [styles.headerTitle, { color: ui.headerForegroundColor }],
        headerTintColor: ui.headerForegroundColor,
        /** Default is centered on iOS; keep leading titles on Android only. */
        headerTitleAlign: Platform.OS === 'android' ? 'left' : 'center',
        headerRight,
        tabBarActiveTintColor: ui.accent,
        tabBarInactiveTintColor: ui.tabBarInactiveTint,
        tabBarStyle,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIconStyle: { marginBottom: -2 },
      }}
    >
      <Tab.Screen
        name="Accounts"
        component={HomeScreen}
        options={{
          title: 'Accounts',
          headerShown: false,
          tabBarLabel: 'Accounts',
          tabBarIcon: ({ color, size }) => (
            <SandboxMaterialIcon name="home" color={color} size={size ?? SANDBOX_ICON_SIZE.tab} />
          ),
        }}
      />
      <Tab.Screen
        name="AgentChat"
        component={AgentScreen}
        options={{
          title: 'Agent chat',
          tabBarLabel: 'Agent chat',
          tabBarIcon: ({ color, size }) => (
            <SandboxMaterialIcon name="auto-awesome" color={color} size={size ?? SANDBOX_ICON_SIZE.tab} />
          ),
        }}
      />
      <Tab.Screen
        name="Transfers"
        component={TransfersTabScreen}
        options={{
          title: 'Transfers',
          tabBarLabel: 'Transfers',
          tabBarIcon: ({ color, size }) => (
            <SandboxMaterialIcon name="swap-horiz" color={color} size={size ?? SANDBOX_ICON_SIZE.tab} />
          ),
        }}
      />
      <Tab.Screen
        name="Payments"
        component={PaymentsTabScreen}
        options={{
          title: 'Check Deposit',
          tabBarLabel: 'Check Deposit',
          tabBarIcon: ({ color, size }) => (
            <SandboxMaterialIcon name="smart-button" color={color} size={size ?? SANDBOX_ICON_SIZE.tab} />
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreNavigator}
        options={{
          title: 'More',
          headerShown: false,
          tabBarLabel: 'More',
          tabBarIcon: ({ color, size }) => (
            <SandboxMaterialIcon name="more-horiz" color={color} size={size ?? SANDBOX_ICON_SIZE.tab} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerPickerHit: {
    marginRight: 12,
    padding: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
