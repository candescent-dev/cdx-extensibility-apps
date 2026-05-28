import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SandboxAppHeader } from '../components/SandboxAppHeader';
import { FdicDisclosureCard } from '../components/FdicDisclosureCard';
import { SANDBOX_DEFAULT_PALETTE } from '../constants/sandboxDesignTokens';
import { AccountCard, type AccountCardTheme } from '../components/AccountCard';
import { WidgetPickerModal } from '../components/WidgetPickerModal';
import { MOCK_ACCOUNTS } from '../data/sandboxAccount';
import { WIDGET_REGISTRY } from '../registry/WIDGET_REGISTRY';
import type { WidgetRegistryItem } from '../registry/types';
import { useSandboxGreeting } from '../hooks/useSandboxGreeting';
import {
  WIDGET_SLOT_BORDER_RADIUS,
  WIDGET_SLOT_MARGIN_VERTICAL,
} from '../constants/widgetChrome';
import { SandboxMaterialIcon } from '../icons/SandboxMaterialIcon';
import { SANDBOX_ICON_SIZE } from '../icons/iconSizes';
import { useBrandingContext } from '@cdx-extensions/di-sdk-mobile';
import { PlatformSDK } from '@cdx-extensions/di-sdk';
import { brandingUiColors } from '../utils/brandingUiColors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const WIDGET_LABELS = ['widget 01', 'widget 02', 'widget 03'] as const;

/** Padding around the cancel glyph inside the dismiss hit target. */
const WIDGET_CANCEL_HIT_PADDING = 4;
/** Outer dismiss box edge length (icon + padding); half used as vertical lift onto corner. */
const WIDGET_CANCEL_CORNER_UP =
  (SANDBOX_ICON_SIZE.close + WIDGET_CANCEL_HIT_PADDING * 2) / 2;
/** Room above hosted widgets so the lifted cancel control doesn’t overlap the prior block. */
const WIDGET_CANCEL_MARGIN_TOP = WIDGET_CANCEL_CORNER_UP + 12;
/** Extra gap below hosted widgets before the next sibling (another widget or section). */
const WIDGET_CANCEL_MARGIN_BOTTOM = 12;

export function HomeScreen() {
  const { theme } = useBrandingContext();
  const ui = brandingUiColors(theme);

  const cardBg = ui.cardBg;
  const pageBg = ui.pageBg;
  const primaryText = ui.primaryText;
  const secondaryText = ui.secondaryText;
  const borderColor = ui.borderColor;
  const accent = ui.accent;
  const primarySubtle = ui.primarySubtle;

  const cardTheme: AccountCardTheme = {
    primaryOutlinedBorder: ui.primaryOutlinedBorder,
    errorSubtle: ui.errorSubtle,
    errorSubtleContrast: ui.errorSubtleContrast,
    infoSubtle: ui.infoSubtle,
    infoSubtleContrast: ui.infoSubtleContrast,
    favoriteBorder: ui.favoriteBorder,
  };

  const { greetingLine, isLoading } = useSandboxGreeting();

  const [accountsOpen, setAccountsOpen] = React.useState(true);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerSlot, setPickerSlot] = React.useState<number | null>(null);
  const [widgetSlots, setWidgetSlots] = React.useState<(WidgetRegistryItem | null)[]>([
    null,
    null,
    null,
  ]);

  function openPickerForSlot(index: number) {
    setPickerSlot(index);
    setPickerOpen(true);
  }

  function onPickWidget(item: WidgetRegistryItem) {
    if (pickerSlot == null) return;
    setWidgetSlots((prev) => {
      const next = [...prev];
      next[pickerSlot] = item;
      return next;
    });
  }

  function clearWidgetSlot(index: number) {
    setWidgetSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }

  const widgetModalRef = React.useRef<unknown | null>(null);
  const thirdPartyHttpClient = React.useMemo(() => PlatformSDK.getInstance().getHttpClient(), []);

  function toggleAccounts() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAccountsOpen((o) => !o);
  }

  /**
   * Embed subtree is unchanged. Dismiss is anchored top-right; lifted vertically only so it sits on
   * the corner without horizontal translate (full-width widgets stay on-screen). Use
   * `scrollable={false}` when this screen’s `ScrollView` is the vertical scroller.
   */
  function renderWidgetSlot(index: number) {
    const w = widgetSlots[index];
    const label = WIDGET_LABELS[index];

    return (
      <View
        key={index}
        style={[styles.widgetSlotOuter, w ? styles.widgetSlotOuterHosted : undefined]}
      >
        {w ? (
          <View style={styles.widgetHostedShell}>
            <w.component
              key={`slot-${index}-${w.id}`}
              scrollable={false}
              httpClient={thirdPartyHttpClient}
              name={w.id}
              modalRef={widgetModalRef}
            />
            <TouchableOpacity
              onPress={() => clearWidgetSlot(index)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${w.name} widget`}
              style={[
                styles.widgetCancelOverlay,
                styles.widgetCloseHit,
                { transform: [{ translateY: -WIDGET_CANCEL_CORNER_UP }] },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <SandboxMaterialIcon name="cancel" color={accent} size={SANDBOX_ICON_SIZE.close} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.widgetInner,
              { borderColor, backgroundColor: cardBg },
            ]}
            onPress={() => openPickerForSlot(index)}
            accessibilityRole="button"
            accessibilityLabel={`Add widget to slot ${index + 1}`}
            activeOpacity={0.85}
          >
            <View style={[styles.fabRing, { borderColor: primarySubtle, backgroundColor: cardBg }, SANDBOX_DEFAULT_PALETTE.fabShadow]}>
              <SandboxMaterialIcon name="add" color={accent} size={SANDBOX_ICON_SIZE.fab} />
            </View>
            <Text style={[styles.widgetCta, { color: accent }]}>{label}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: pageBg }]}>
      <SandboxAppHeader />

      <ScrollView
        style={[styles.scroll, { backgroundColor: pageBg }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.greetingRow}>
          <Text style={[styles.greeting, { color: primaryText }]}>
            {isLoading ? '…' : greetingLine}
          </Text>
        </View>

        <View style={styles.fdicPad}>
          <FdicDisclosureCard
            borderColor={borderColor}
            backgroundColor={cardBg}
            markColor={SANDBOX_DEFAULT_PALETTE.fdicDisclosureInk}
            copyColor={SANDBOX_DEFAULT_PALETTE.fdicDisclosureInk}
          />
        </View>

        <View style={styles.topWidgetsSection}>
          {renderWidgetSlot(0)}
          {renderWidgetSlot(1)}
        </View>

        {/* Internal accounts: small label row sitting on the page background */}
        <View style={styles.accountsSection}>
          <TouchableOpacity
            onPress={toggleAccounts}
            accessibilityRole="button"
            accessibilityState={{ expanded: accountsOpen }}
            accessibilityLabel="Internal Accounts"
            activeOpacity={0.85}
            style={styles.accountsHeaderStrip}
          >
            <Text style={[styles.accountsTitle, { color: primaryText }]}>Internal Accounts</Text>
            <SandboxMaterialIcon
              name={accountsOpen ? 'arrow-drop-down' : 'arrow-drop-up'}
              color={primaryText}
              size={SANDBOX_ICON_SIZE.sectionChevron}
            />
          </TouchableOpacity>

          {accountsOpen ? (
            <View
              style={[
                styles.accountListSurface,
                { backgroundColor: cardBg },
                Platform.OS === 'ios' ? SANDBOX_DEFAULT_PALETTE.contentCardShadow : { elevation: 8 },
              ]}
            >
              <View style={styles.accountList}>
                {MOCK_ACCOUNTS.map((account, index) => (
                  <React.Fragment key={account.id}>
                    {index > 0 ? (
                      <View style={[styles.accountDivider, { backgroundColor: borderColor }]} />
                    ) : null}
                    <AccountCard
                      account={account}
                      primaryText={primaryText}
                      secondaryText={secondaryText}
                      accentColor={accent}
                      cardTheme={cardTheme}
                    />
                  </React.Fragment>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.disclaimerPad}>
          <Text style={[styles.disclaimer, { color: secondaryText }]}>
            †This balance may include overdraft or line of credit funds.
          </Text>
        </View>

        <View style={styles.bottomWidgetSection}>{renderWidgetSlot(2)}</View>
      </ScrollView>

      <WidgetPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        items={WIDGET_REGISTRY}
        onPick={onPickWidget}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  greetingRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
    letterSpacing: -0.32,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingBottom: 24,
  },
  fdicPad: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  /** Third-party slots: full width of the scroll content; widgets own horizontal inset. */
  topWidgetsSection: {
    paddingTop: 8,
    marginBottom: 12,
    overflow: 'visible',
  },
  bottomWidgetSection: {
    paddingTop: 12,
    marginBottom: 8,
    overflow: 'visible',
  },
  accountsSection: {
    marginHorizontal: 0,
  },
  accountsHeaderStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  accountListSurface: {
    marginTop: 4,
    marginHorizontal: 0,
    padding: 4,
    borderRadius: 8,
    overflow: Platform.OS === 'ios' ? 'visible' : 'hidden',
  },
  widgetSlotOuter: {
    overflow: 'visible',
  },
  /** Vertical rhythm when a dismiss control protrudes above the embed bounds. */
  widgetSlotOuterHosted: {
    marginTop: WIDGET_CANCEL_MARGIN_TOP,
    marginBottom: WIDGET_CANCEL_MARGIN_BOTTOM,
  },
  /** Bounds for overlay; matches embed width/height without changing embed props. */
  widgetHostedShell: {
    position: 'relative',
    width: '100%',
    overflow: 'visible',
  },
  /** Top-right of shell; translateY pulls onto corner (no translateX — avoids past screen edge). */
  widgetCancelOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
    ...Platform.select({
      android: { elevation: 8 },
    }),
  },
  widgetCloseHit: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: WIDGET_CANCEL_HIT_PADDING,
  },
  widgetInner: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: WIDGET_SLOT_BORDER_RADIUS,
    minHeight: 114,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    overflow: 'hidden',
    marginVertical: WIDGET_SLOT_MARGIN_VERTICAL,
    marginHorizontal: 16,
  },
  fabRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetCta: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 24,
    letterSpacing: -0.08,
    textAlign: 'center',
  },
  accountsTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: -0.16,
  },
  accountList: {
    gap: 0,
    paddingHorizontal: 0,
  },
  accountDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 0,
    marginHorizontal: 0,
  },
  disclaimerPad: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
  },
});
