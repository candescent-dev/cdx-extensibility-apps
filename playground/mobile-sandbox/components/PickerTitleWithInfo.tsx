import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useBrandingContext } from '@cdx-extensions/di-sdk-mobile';
import { SandboxMaterialIcon } from '../icons/SandboxMaterialIcon';
import { brandingUiColors } from '../utils/brandingUiColors';

export const WIDGET_PICKER_SCAFFOLD_HINT =
  'Scaffold a new widget with `nx g @cdx-extensions/widget-template-mobile:widget --fiId=<id> --name=<name>` — it auto-registers in registry/WIDGET_REGISTRY.ts and shows up here.';

export const FEATURE_PICKER_SCAFFOLD_HINT =
  'Scaffold a new feature with `nx g @cdx-extensions/widget-template-mobile:feature --fiId=<id> --name=<name>` — it auto-registers in registry/FEATURE_REGISTRY.tsx as `builtIn: false` and shows up here.';

export function PickerTitleWithInfo({
  title,
  hintText,
  sheetVisible,
  infoAccessibilityLabel = 'Scaffolding help',
}: {
  title: string;
  hintText: string;
  /** When the parent sheet closes, the info dialog is dismissed. */
  sheetVisible: boolean;
  infoAccessibilityLabel?: string;
}) {
  const { theme } = useBrandingContext();
  const ui = brandingUiColors(theme);
  const bg = theme.colors.background?.default ?? '#fff';
  const text = theme.colors.text?.primary ?? '#111';

  const [infoVisible, setInfoVisible] = React.useState(false);

  React.useEffect(() => {
    if (!sheetVisible) setInfoVisible(false);
  }, [sheetVisible]);

  return (
    <>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: text }]} numberOfLines={1}>
          {title}
        </Text>
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            setInfoVisible(true);
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={infoAccessibilityLabel}
        >
          <SandboxMaterialIcon name="info-outline" size={22} color={ui.accent} />
        </Pressable>
      </View>

      <Modal
        visible={infoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoVisible(false)}
      >
        <Pressable style={styles.infoOverlay} onPress={() => setInfoVisible(false)}>
          <Pressable
            style={[
              styles.infoCard,
              { backgroundColor: bg, borderColor: ui.borderColor },
              styles.infoCardShadow,
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.infoHeading, { color: text }]}>Add with the CLI</Text>
            <ScrollView
              style={styles.infoScroll}
              contentContainerStyle={styles.infoScrollContent}
              showsVerticalScrollIndicator={true}
            >
              <Text style={[styles.infoBody, { color: text }]}>{hintText}</Text>
            </ScrollView>
            <TouchableOpacity
              style={[styles.infoDone, { backgroundColor: ui.accent }]}
              onPress={() => setInfoVisible(false)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Close scaffolding help"
            >
              <Text style={[styles.infoDoneLabel, { color: ui.headerForegroundColor }]}>OK</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 8,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '700' },
  infoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  infoCard: {
    borderRadius: 20,
    paddingTop: 24,
    paddingHorizontal: 22,
    paddingBottom: 20,
    maxHeight: '78%',
    borderWidth: StyleSheet.hairlineWidth,
  },
  infoCardShadow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
    },
    android: { elevation: 10 },
    default: {},
  }),
  infoHeading: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  infoScroll: { flexGrow: 0, maxHeight: 340 },
  infoScrollContent: { paddingBottom: 4 },
  infoBody: { fontSize: 18, lineHeight: 28, letterSpacing: -0.2 },
  infoDone: {
    marginTop: 20,
    alignSelf: 'stretch',
    minHeight: 48,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoDoneLabel: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
});
