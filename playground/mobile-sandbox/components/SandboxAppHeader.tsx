import * as React from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrandingContext } from '@cdx-extensions/di-sdk-mobile';
import { BrandingPicker, BrandingPickerHeaderSettingsTrigger } from '../navigation/BrandingPicker';
import { brandingUiColors } from '../utils/brandingUiColors';
import { HEADER_MARK_TO_NAME_GAP } from '../constants/accountsHeaderLayout';
import { CandescentHeaderMark } from './CandescentHeaderMark';

/** Display name beside logo — text fallback when a composite logo asset is not used. */
const INSTITUTION_DISPLAY_NAME = 'Candescent';

const LOGO_SIZE = 44;
/** Inset inside the clipped square so the isometric mark does not anti-alias past rounded corners. */
const LOGO_MARK_INSET = 38;

/**
 * Global app bar: mark + institution name + theme control.
 * Leading cluster uses a fixed gap between mark and name (see `HEADER_MARK_TO_NAME_GAP`).
 */
export function SandboxAppHeader() {
  const insets = useSafeAreaInsets();
  const { theme } = useBrandingContext();
  const ui = brandingUiColors(theme);

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: ui.headerBarBg,
          paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 8 : 12),
        },
      ]}
    >
      <View style={styles.body}>
        <View style={styles.leading} accessible accessibilityRole="header" accessibilityLabel="Candescent">
          <View style={styles.logoClip}>
            <CandescentHeaderMark size={LOGO_MARK_INSET} />
          </View>
          <Text
            style={[styles.institutionName, { color: ui.headerForegroundColor }]}
            numberOfLines={1}
            maxFontSizeMultiplier={2}
          >
            {INSTITUTION_DISPLAY_NAME}
          </Text>
        </View>
        <BrandingPicker
          trigger={(open) => (
            <BrandingPickerHeaderSettingsTrigger
              onOpen={open}
              iconColor={ui.headerForegroundColor}
              style={styles.themeHit}
            />
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  leading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    gap: HEADER_MARK_TO_NAME_GAP,
  },
  logoClip: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Title beside logo — large enough to balance ~44dp mark. */
  institutionName: {
    flex: 1,
    minWidth: 0,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  themeHit: {
    padding: 4,
  },
});
