import * as React from 'react';
import { Text, Modal, FlatList, Pressable } from 'react-native';
import { useBrandingContext } from '@cdx-extensions/di-sdk-mobile';
import type { FeatureRegistryItem } from '../registry/types';
import { brandingUiColors } from '../utils/brandingUiColors';
import {
  FEATURE_PICKER_SCAFFOLD_HINT,
  PickerTitleWithInfo,
} from './PickerTitleWithInfo';
import {
  extensionPickerSheetStyles,
  PickerListRow,
} from './PickerListRow';

export function FeaturePickerModal({
  visible,
  onClose,
  items,
  onPick,
  title = 'Add feature',
  listHeaderComponent,
  listEmptyText = 'Nothing to show.',
}: {
  visible: boolean;
  onClose: () => void;
  items: FeatureRegistryItem[];
  onPick: (item: FeatureRegistryItem) => void;
  title?: string;
  listHeaderComponent?: React.ReactElement | null;
  /** Shown when `items` is empty. */
  listEmptyText?: string;
}) {
  const { theme } = useBrandingContext();
  const ui = brandingUiColors(theme);
  const bg = theme.colors.background?.default ?? '#fff';
  const text = theme.colors.text?.primary ?? '#111';
  const sub = theme.colors.text?.secondary ?? '#666';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={extensionPickerSheetStyles.overlay} onPress={onClose}>
        <Pressable
          style={[extensionPickerSheetStyles.sheet, { backgroundColor: bg }]}
          onPress={(e) => e.stopPropagation()}
        >
          <PickerTitleWithInfo
            title={title}
            hintText={FEATURE_PICKER_SCAFFOLD_HINT}
            sheetVisible={visible}
            infoAccessibilityLabel="How to scaffold a new feature"
          />
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            ListHeaderComponent={listHeaderComponent ?? undefined}
            ListEmptyComponent={
              <Text style={[extensionPickerSheetStyles.empty, { color: sub }]}>
                {listEmptyText}
              </Text>
            }
            renderItem={({ item }) => (
              <PickerListRow
                title={item.label}
                description={item.description}
                materialIcon={item.materialIcon}
                iconColor={ui.accent}
                primaryTextColor={text}
                secondaryTextColor={sub}
                onPress={() => {
                  onPick(item);
                  onClose();
                }}
              />
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
