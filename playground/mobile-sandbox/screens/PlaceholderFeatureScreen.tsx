/**
 * PlaceholderFeatureScreen
 *
 * Shared placeholder for sandbox features that have not been implemented yet.
 * Optional {@link PlaceholderFeatureScreenProps.ctaLabel} / {@link PlaceholderFeatureScreenProps.onCta}
 * add a primary button. When {@link PlaceholderFeatureScreenProps.fiDeveloperMessage} is set, the
 * full stack (icon → title → body → developer card → CTA) is centered as a single vertical block
 * within the visible content area (between the header and tab bar).
 *
 * Wrap paths in backticks in {@link PlaceholderFeatureScreenProps.fiDeveloperMessage}
 * (e.g. `navigation/tabs.tsx`) so they render in monospace inside the developer callout.
 */
import * as React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useBrandingContext } from '@cdx-extensions/di-sdk-mobile';
import { SandboxMaterialIcon } from '../icons/SandboxMaterialIcon';
import { brandingUiColors } from '../utils/brandingUiColors';

/** Neutral panel fill similar to the sandbox reference screenshot. */
const DEV_CARD_FILL_FALLBACK = '#F5F5F7';

export type PlaceholderFeatureScreenProps = {
  title: string;
  body: string;
  /** Material icon name — same icon used in the More menu row and bottom tab. */
  materialIcon?: string;
  /** Label for the CTA button (tab placeholder screens). */
  ctaLabel?: string;
  /** Handler for the CTA button. */
  onCta?: () => void;
  /**
   * Developer callout directly under the placeholder body. With this prop set, the full stack
   * (icon → title → body → card → CTA) is centered as a single vertical block within the visible
   * content area (between the header and tab bar).
   */
  fiDeveloperMessage?: string;
};

function FiDeveloperMessageText({
  message,
  primaryColor,
  codeColor,
}: {
  message: string;
  primaryColor: string;
  codeColor: string;
}) {
  const parts = message.split(/(`[^`]*`)/g);
  return (
    <Text style={[styles.devBody, { color: primaryColor }]}>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          const inner = part.slice(1, -1);
          return (
            <Text key={i} style={[styles.devCode, { color: codeColor }]}>
              {inner}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

export function PlaceholderFeatureScreen({
  title,
  body,
  materialIcon = 'extension',
  ctaLabel,
  onCta,
  fiDeveloperMessage,
}: PlaceholderFeatureScreenProps) {
  const { theme } = useBrandingContext();
  const ui = brandingUiColors(theme);
  const { height: windowHeight } = useWindowDimensions();

  /** SVG spec: primary at ~12% opacity over page (e.g. #1A6CDA + alpha). */
  const iconRingBg =
    ui.accent.startsWith('#') && ui.accent.length === 7 ? `${ui.accent}1F` : ui.primarySubtle;

  const showDeveloperCard = Boolean(fiDeveloperMessage);
  const showButton = Boolean(onCta || ctaLabel);
  const buttonLabel = ctaLabel ?? '';
  const onButtonPress = onCta ?? (ctaLabel ? () => {} : undefined);

  const bodyColor = showDeveloperCard ? ui.primaryText : ui.secondaryText;

  const ctaButton = showButton ? (
    <TouchableOpacity
      style={[styles.ctaButton, { backgroundColor: ui.accent }]}
      onPress={onButtonPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={buttonLabel}
    >
      <Text style={[styles.ctaButtonText, { color: ui.headerForegroundColor }]}>
        {buttonLabel}
      </Text>
    </TouchableOpacity>
  ) : null;

  const paper =
    theme.colors.background?.paper ??
    theme.colors.background?.default ??
    DEV_CARD_FILL_FALLBACK;

  const devCardBackground =
    paper === ui.pageBg ? DEV_CARD_FILL_FALLBACK : paper;

  const placeholderMain = (
    <>
      <View style={[styles.iconRing, styles.iconRingSpacing, { backgroundColor: iconRingBg }]}>
        <SandboxMaterialIcon
          name={materialIcon as React.ComponentProps<typeof SandboxMaterialIcon>['name']}
          size={44}
          color={ui.accent}
        />
      </View>
      <Text style={[styles.title, styles.titleSpacing, { color: ui.primaryText }]}>{title}</Text>
      <Text
        style={[
          styles.body,
          showButton && !showDeveloperCard ? styles.bodySpacing : null,
          { color: bodyColor },
        ]}
      >
        {body}
      </Text>

      {showButton && !showDeveloperCard ? <View style={styles.ctaRow}>{ctaButton}</View> : null}
    </>
  );

  if (showDeveloperCard) {
    return (
      <ScrollView
        style={[styles.root, { backgroundColor: ui.pageBg }]}
        contentContainerStyle={[styles.scrollContent, styles.scrollDevStack]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.devStackColumn}>
          <View style={styles.devStackHero}>{placeholderMain}</View>
          <View
            style={[
              styles.devCard,
              {
                borderColor: ui.borderColor,
                backgroundColor: devCardBackground,
              },
            ]}
            accessibilityRole="summary"
            accessibilityLabel="Information for developers"
          >
            <View style={styles.devCardHeader}>
              <View style={[styles.devInfoBadge, { backgroundColor: ui.accent }]}>
                <Text style={[styles.devInfoGlyph, { color: ui.headerForegroundColor }]}>i</Text>
              </View>
              <Text style={[styles.devCardTitle, { color: ui.primaryText }]}>
                INFORMATION FOR DEVELOPERS
              </Text>
            </View>
            <FiDeveloperMessageText
              message={fiDeveloperMessage!}
              primaryColor={ui.secondaryText}
              codeColor={ui.primaryText}
            />
          </View>
          {showButton ? <View style={styles.devStackCta}>{ctaButton}</View> : null}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: ui.pageBg }]}
      contentContainerStyle={[
        styles.scrollContent,
        styles.scrollCenteredOnly,
        { minHeight: windowHeight },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.placeholderSection}>{placeholderMain}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    paddingBottom: 28,
  },
  scrollCenteredOnly: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  /**
   * Icon → title → body → developer card → CTA centered as one vertical block within the visible
   * content area (between the header and tab bar). `flexGrow: 1` lets the content container fill
   * the actual ScrollView height — do not add `minHeight: windowHeight` here, that inflates the
   * layout beyond the visible area and pulls the centered block off-screen.
   */
  scrollDevStack: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  devStackColumn: {
    width: '100%',
    paddingHorizontal: 20,
  },
  devStackHero: {
    alignItems: 'center',
    width: '100%',
  },
  devStackCta: {
    width: '100%',
    alignItems: 'center',
    marginTop: 28,
  },
  placeholderSection: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRingSpacing: {
    marginBottom: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.35,
    textAlign: 'center',
  },
  titleSpacing: {
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 340,
  },
  bodySpacing: {
    marginBottom: 48,
  },
  ctaRow: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  ctaButton: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 8,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.16,
  },
  devCard: {
    alignSelf: 'stretch',
    width: '100%',
    marginTop: 28,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  devCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  devInfoBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devInfoGlyph: {
    fontSize: 13,
    fontWeight: '700',
    fontStyle: 'italic',
    includeFontPadding: false,
  },
  devCardTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    lineHeight: 16,
    includeFontPadding: false,
  },
  devBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  devCode: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 13,
    lineHeight: 21,
  },
});
