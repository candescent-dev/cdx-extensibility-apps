import * as React from 'react';
import { Platform, ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBrandingContext } from '@cdx-extensions/di-sdk-mobile';

import { useAddedFeatures } from '../context/AddedFeaturesContext';
import { FEATURE_REGISTRY, getFeatureById } from '../registry/FEATURE_REGISTRY';
import { BrandingPicker, BrandingPickerHeaderSettingsTrigger } from './BrandingPicker';
import { FeaturePickerModal } from '../components/FeaturePickerModal';
import { SandboxMaterialIcon } from '../icons/SandboxMaterialIcon';
import { SANDBOX_ICON_SIZE } from '../icons/iconSizes';
import { brandingUiColors } from '../utils/brandingUiColors';
import { SANDBOX_DEFAULT_PALETTE } from '../constants/sandboxDesignTokens';
import type { NavigationProp } from '@react-navigation/native';
import type { FeatureRegistryItem } from '../registry/types';
import type { MoreStackParamList, RootTabParamList } from './types';

const Stack = createNativeStackNavigator<MoreStackParamList>();

function MoreMenuScreen({ navigation }: NativeStackScreenProps<MoreStackParamList, 'MoreMenu'>) {
  const { addedFeatureIds, addFeatureId } = useAddedFeatures();
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const { theme } = useBrandingContext();
  const ui = brandingUiColors(theme);

  const visibleRows = React.useMemo(
    () =>
      FEATURE_REGISTRY.filter(
        (f) => f.builtIn || (f.builtIn === false && addedFeatureIds.includes(f.id))
      ),
    [addedFeatureIds],
  );

  const addable = React.useMemo(
    () =>
      FEATURE_REGISTRY.filter(
        (f): f is Extract<FeatureRegistryItem, { component: React.ComponentType }> =>
          f.builtIn === false && 'component' in f && !addedFeatureIds.includes(f.id),
      ),
    [addedFeatureIds],
  );

  function openRow(f: FeatureRegistryItem) {
    if ('navigateToTab' in f && f.navigateToTab) {
      const parent = navigation.getParent<NavigationProp<RootTabParamList>>();
      const tab = f.navigateToTab;
      if (tab === 'AgentChat' || tab === 'Transfers' || tab === 'Payments') {
        parent?.navigate(tab, { fromMore: true });
        return;
      }
      parent?.navigate(tab);
      return;
    }
    if ('component' in f && f.component) {
      navigation.navigate('FeatureDetail', { featureId: f.id });
    }
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: ui.pageBg }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Menu items list ── */}
      <View style={[styles.listCard, { backgroundColor: ui.cardBg, borderBottomColor: ui.borderColor }]}>
        {visibleRows.map((item, index) => {
          const isLast = index === visibleRows.length - 1;
          const labelColor = ui.primaryText;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.listRow,
                !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ui.borderColor },
              ]}
              onPress={() => openRow(item)}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={styles.rowLeft}>
                {item.materialIcon ? (
                  <SandboxMaterialIcon
                    name={item.materialIcon as React.ComponentProps<typeof SandboxMaterialIcon>['name']}
                    size={SANDBOX_ICON_SIZE.rowLeading}
                    color={labelColor}
                  />
                ) : (
                  <Text style={styles.rowIconFallback}>{item.icon}</Text>
                )}
                <Text style={[styles.rowLabel, { color: labelColor }]}>{item.label}</Text>
              </View>
              <SandboxMaterialIcon
                name="keyboard-arrow-right"
                size={SANDBOX_ICON_SIZE.chevron}
                color={labelColor}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Add Feature slot ── */}
      <View style={styles.addSection}>
        <TouchableOpacity
          style={[styles.addCard, { backgroundColor: ui.cardBg, borderColor: ui.borderColor }]}
          onPress={() => setPickerOpen(true)}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Add Feature"
        >
          <View
            style={[
              styles.addFab,
              SANDBOX_DEFAULT_PALETTE.fabShadow,
              { backgroundColor: ui.cardBg, borderColor: ui.primarySubtle },
            ]}
          >
            <SandboxMaterialIcon name="add" size={SANDBOX_ICON_SIZE.fab} color={ui.accent} />
          </View>
          <Text style={[styles.addLabel, { color: ui.primaryText }]}>Add Feature</Text>
        </TouchableOpacity>
      </View>

      <FeaturePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        items={addable}
        listEmptyText="There are no features to add. Everything available is already included."
        onPick={async (item) => {
          await addFeatureId(item.id);
        }}
      />
    </ScrollView>
  );
}

type FeatureDetailProps = { materialIcon?: string };

function FeatureDetailScreen({ route }: NativeStackScreenProps<MoreStackParamList, 'FeatureDetail'>) {
  const { featureId } = route.params;

  const f = getFeatureById(featureId);

  if (!f || !('component' in f) || !f.component) {
    return (
      <View style={styles.fallback}>
        <Text>Feature missing</Text>
      </View>
    );
  }

  const C = f.component as React.ComponentType<FeatureDetailProps>;
  return <C materialIcon={f.materialIcon} />;
}

export function MoreNavigator() {
  const { theme } = useBrandingContext();
  const ui = brandingUiColors(theme);

  /** Matches the leading-cluster header on Home (`SandboxAppHeader`): single settings glyph. */
  const settingsThemePicker = React.useCallback(
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

  /** iOS 26+: avoids the default shared capsule/glass background behind custom header controls. */
  const unstable_headerRightItems = React.useCallback(
    () => [
      {
        type: 'custom' as const,
        hidesSharedBackground: true,
        element: settingsThemePicker(),
      },
    ],
    [settingsThemePicker],
  );

  const themedHeaderOptions = React.useMemo(
    () => ({
      headerStyle: { backgroundColor: ui.headerBarBg },
      headerShadowVisible: false,
      headerTitleStyle: {
        color: ui.headerForegroundColor,
        fontSize: 20,
        fontWeight: '700' as const,
        letterSpacing: -0.3,
      },
      headerTintColor: ui.headerForegroundColor,
      headerRight: settingsThemePicker,
      ...(Platform.OS === 'ios' ? { unstable_headerRightItems } : {}),
    }),
    [ui.headerBarBg, ui.headerForegroundColor, settingsThemePicker, unstable_headerRightItems],
  );

  return (
    <Stack.Navigator id="MoreStack" screenOptions={themedHeaderOptions}>
      <Stack.Screen name="MoreMenu" component={MoreMenuScreen} options={{ title: 'More' }} />
      <Stack.Screen
        name="FeatureDetail"
        component={FeatureDetailScreen}
        options={({ route }) => ({
          title: getFeatureById(route.params.featureId)?.label ?? '',
          headerBackVisible: true,
          headerBackTitleVisible: false,
        })}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  listCard: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  rowIconFallback: {
    fontSize: 20,
    width: 24,
    textAlign: 'center',
  },
  rowLabel: {
    fontSize: 16,
    letterSpacing: -0.16,
  },
  addSection: {
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 22,
    gap: 16,
  },
  addFab: {
    width: 40,
    height: 40,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.24,
  },
  headerPickerHit: {
    marginRight: 4,
    padding: 4,
  },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
