import * as React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SandboxMaterialIcon } from '../icons/SandboxMaterialIcon';
import { SANDBOX_ICON_SIZE } from '../icons/iconSizes';

/** Bottom sheet chrome shared by widget and feature pickers. */
export const extensionPickerSheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: '72%',
  },
  empty: { padding: 24, fontSize: 14, textAlign: 'center', lineHeight: 21 },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  rowLeadingWrap: {
    width: 32,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowDesc: { fontSize: 13, marginTop: 2 },
});

const DEFAULT_MATERIAL_ICON = 'extension';

type PickerListRowProps = {
  title: string;
  description: string;
  /** Material Icons glyph name; defaults to `extension` when omitted. */
  materialIcon?: string;
  onPress: () => void;
  /** Typically branding primary / accent for list leading icons. */
  iconColor: string;
  primaryTextColor: string;
  secondaryTextColor: string;
};

export function PickerListRow({
  title,
  description,
  materialIcon = DEFAULT_MATERIAL_ICON,
  onPress,
  iconColor,
  primaryTextColor,
  secondaryTextColor,
}: PickerListRowProps) {
  return (
    <TouchableOpacity
      style={extensionPickerSheetStyles.row}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={extensionPickerSheetStyles.rowLeadingWrap}>
        <SandboxMaterialIcon
          name={materialIcon as React.ComponentProps<typeof SandboxMaterialIcon>['name']}
          size={SANDBOX_ICON_SIZE.rowLeading + 10}
          color={iconColor}
        />
      </View>
      <View style={extensionPickerSheetStyles.rowText}>
        <Text style={[extensionPickerSheetStyles.rowTitle, { color: primaryTextColor }]}>
          {title}
        </Text>
        <Text style={[extensionPickerSheetStyles.rowDesc, { color: secondaryTextColor }]}>
          {description}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
