import * as React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { SandboxAccount } from '../data/sandboxAccount';
import { SandboxMaterialIcon } from '../icons/SandboxMaterialIcon';

/** Typography-driven row; favorite control uses comfortable hit slop. */
const FAVORITE_ICON_SIZE = 20;
const FAVORITE_HIT_SLOP = { top: 5, bottom: 5, left: 5, right: 5 };

export type AccountCardTheme = {
  primaryOutlinedBorder: string;
  errorSubtle: string;
  errorSubtleContrast: string;
  infoSubtle: string;
  infoSubtleContrast: string;
  /** Outline heart — theme `favoriteBorder` from branding tokens. */
  favoriteBorder: string;
};

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Favorite toggle — Material `favorite` / `favorite-border`; filled uses accent, outline uses `favoriteBorder`.
 */
function AccountFavoriteButton({
  initial,
  filledColor,
  outlineColor,
}: {
  initial: boolean;
  filledColor: string;
  outlineColor: string;
}) {
  const [isFavorite, setIsFavorite] = React.useState(initial);
  React.useEffect(() => {
    setIsFavorite(initial);
  }, [initial]);

  return (
    <View style={styles.favWrap}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={
          isFavorite ? 'Remove as favorite account' : 'Mark as favorite account'
        }
        accessibilityState={{ selected: isFavorite }}
        hitSlop={FAVORITE_HIT_SLOP}
        onPress={() => setIsFavorite((v) => !v)}
      >
        <SandboxMaterialIcon
          name={isFavorite ? 'favorite' : 'favorite-border'}
          size={FAVORITE_ICON_SIZE}
          color={isFavorite ? filledColor : outlineColor}
        />
      </TouchableOpacity>
    </View>
  );
}

export function AccountCard({
  account,
  primaryText,
  secondaryText,
  accentColor,
  cardTheme,
}: {
  account: SandboxAccount;
  primaryText: string;
  secondaryText: string;
  accentColor: string;
  cardTheme: AccountCardTheme;
}) {
  const outlineBorder = { borderColor: cardTheme.primaryOutlinedBorder };

  const titleRow = (
    <View style={styles.titleRow}>
      <Text style={[styles.titleLine, { color: primaryText, flex: 1 }]}>
        {account.displayName} {account.maskedNumber}
      </Text>
      <AccountFavoriteButton
        initial={account.favorite}
        filledColor={accentColor}
        outlineColor={cardTheme.favoriteBorder}
      />
    </View>
  );

  if (account.layout === 'credit_two_col') {
    return (
      <View style={styles.card}>
        {titleRow}
        {account.statusBadge ? (
          <View
            style={[
              styles.badge,
              account.statusBadge.variant === 'error'
                ? { backgroundColor: cardTheme.errorSubtle }
                : { backgroundColor: cardTheme.infoSubtle },
            ]}
          >
            <SandboxMaterialIcon
              name={account.statusBadge.variant === 'error' ? 'error' : 'info'}
              size={14}
              color={
                account.statusBadge.variant === 'error'
                  ? cardTheme.errorSubtleContrast
                  : cardTheme.infoSubtleContrast
              }
              style={styles.badgeMaterialIcon}
            />
            <Text
              style={[
                styles.badgeText,
                account.statusBadge.variant === 'error'
                  ? { color: cardTheme.errorSubtleContrast }
                  : { color: cardTheme.infoSubtleContrast },
              ]}
            >
              {account.statusBadge.text}
            </Text>
          </View>
        ) : null}
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={[styles.colLabel, { color: secondaryText }]}>{account.leftLabel}</Text>
            <Text style={[styles.colAmount, { color: primaryText }]}>
              {formatCurrency(account.leftAmount)}
            </Text>
          </View>
          <View style={styles.col}>
            <Text style={[styles.colLabel, styles.colLabelRight, { color: secondaryText }]}>
              {account.rightLabel}
            </Text>
            <Text style={[styles.colAmount, styles.colAmountRight, { color: primaryText }]}>
              {formatCurrency(account.rightAmount)}
            </Text>
          </View>
        </View>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.btnOutline, outlineBorder]}
            accessibilityRole="button"
            accessibilityLabel="Statements"
          >
            <Text style={[styles.btnOutlineText, { color: accentColor }]}>Statements</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnOutline, outlineBorder]}
            accessibilityRole="button"
            accessibilityLabel="Transfer"
          >
            <Text style={[styles.btnOutlineText, { color: accentColor }]}>Transfer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnSolid, { backgroundColor: accentColor }]}
            accessibilityRole="button"
            accessibilityLabel="Pay"
          >
            <Text style={styles.btnSolidText}>Pay</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {titleRow}
      <Text style={[styles.colLabel, { color: secondaryText, marginTop: 4 }]}>
        {account.balanceLabel}
      </Text>
      <Text style={[styles.singleAmount, { color: primaryText }]}>
        {formatCurrency(account.balance)}
      </Text>
      <View style={styles.actionsRowEnd}>
        <TouchableOpacity
          style={[styles.btnSolid, { backgroundColor: accentColor }]}
          accessibilityRole="button"
        >
          <Text style={styles.btnSolidText}>{account.primaryAction}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  favWrap: {
    alignSelf: 'center',
  },
  titleLine: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    letterSpacing: -0.16,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 24,
    paddingRight: 8,
    borderRadius: 100,
    marginTop: 4,
    overflow: 'hidden',
  },
  badgeMaterialIcon: { marginLeft: 6 },
  badgeText: { fontSize: 13, fontWeight: '500', lineHeight: 15.6, paddingHorizontal: 8 },
  twoCol: {
    flexDirection: 'row',
    gap: 8,
  },
  col: { flex: 1 },
  colLabel: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: -0.08,
  },
  colLabelRight: { textAlign: 'right' },
  colAmount: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
    marginTop: 4,
  },
  colAmountRight: { textAlign: 'right' },
  singleAmount: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionsRowEnd: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  btnOutline: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  btnOutlineText: { fontSize: 13, fontWeight: '500', lineHeight: 24, letterSpacing: -0.08 },
  btnSolid: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  btnSolidText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 24,
    letterSpacing: -0.08,
  },
});
