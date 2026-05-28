import * as React from 'react';
import {
  TouchableOpacity,
  Modal,
  View,
  StyleSheet,
  Pressable,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useBrandingContext } from '@cdx-extensions/di-sdk-mobile';
import { SandboxMaterialIcon } from '../icons/SandboxMaterialIcon';
import { SANDBOX_ICON_SIZE } from '../icons/iconSizes';

type BrandingPickerProps = {
  /** Custom trigger; receives `open` to show the theme menu. */
  trigger?: (open: () => void) => React.ReactNode;
};

/** Header-bar settings glyph; shared by tab/stack headers and `SandboxAppHeader`. */
export function BrandingPickerHeaderSettingsTrigger({
  onOpen,
  iconColor,
  style,
}: {
  onOpen: () => void;
  iconColor: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onOpen}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Theme"
      style={style}
    >
      <SandboxMaterialIcon name="settings" color={iconColor} size={SANDBOX_ICON_SIZE.header} />
    </Pressable>
  );
}

export function BrandingPicker({ trigger }: BrandingPickerProps) {
  const [visible, setVisible] = React.useState(false);
  const open = React.useCallback(() => setVisible(true), []);
  const close = React.useCallback(() => setVisible(false), []);
  const { brandingId, setBrandingId, availableBrandings, theme } = useBrandingContext();
  const accent = theme.colors.primary.main ?? '#1976D2';
  const activeRowBg = theme.colors.primary.subtle ?? '#F2F2F7';

  return (
    <>
      {trigger ? (
        trigger(open)
      ) : (
        <TouchableOpacity onPress={open} style={styles.headerButton} hitSlop={8}>
          <SandboxMaterialIcon name="settings" color={theme.colors.text.primary} size={SANDBOX_ICON_SIZE.header} />
        </TouchableOpacity>
      )}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.overlay} onPress={close}>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>Theme</Text>
            {availableBrandings.map((branding) => {
              const isActive = branding.id === brandingId;
              return (
                <TouchableOpacity
                  key={branding.id}
                  style={[styles.menuItem, isActive && { backgroundColor: activeRowBg }]}
                  onPress={() => {
                    setBrandingId(branding.id);
                    close();
                  }}
                >
                  <Text
                    style={[
                      styles.menuItemText,
                      isActive && { fontWeight: '600' as const, color: accent },
                    ]}
                  >
                    {branding.name}
                  </Text>
                  {isActive ? (
                    <Text style={[styles.checkmark, { color: accent }]}>✓</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerButton: { marginRight: 16, padding: 4 },
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
  menuItemText: { fontSize: 16, color: '#1C1C1E' },
  checkmark: { fontSize: 16, fontWeight: '700', marginLeft: 12 },
});
