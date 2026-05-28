import type { BrandingContextValue } from '@cdx-extensions/di-sdk-mobile';
import { SANDBOX_DEFAULT_PALETTE } from '../constants/sandboxDesignTokens';

type SandboxTheme = BrandingContextValue['theme'];

/** Maps `BrandingContext` theme to dashboard / tab chrome; uses defaults when roles are missing. */
export function brandingUiColors(theme: SandboxTheme) {
  const accent = theme.colors.primary.main ?? SANDBOX_DEFAULT_PALETTE.primaryMain;
  const primaryOutline =
    accent.startsWith('#') && accent.length === 7
      ? `${accent}99`
      : SANDBOX_DEFAULT_PALETTE.primaryOutlinedBorder;

  return {
    pageBg: theme.colors.background.default ?? SANDBOX_DEFAULT_PALETTE.backgroundDefault,
    cardBg:
      theme.colors.background.paper ??
      theme.colors.background.default ??
      SANDBOX_DEFAULT_PALETTE.backgroundPaper,
    primaryText: theme.colors.text.primary ?? SANDBOX_DEFAULT_PALETTE.textPrimary,
    secondaryText: theme.colors.text.secondary ?? SANDBOX_DEFAULT_PALETTE.textSecondary,
    tabBarInactiveTint:
      theme.colors.grey?.['600'] ??
      theme.colors.text.secondary ??
      SANDBOX_DEFAULT_PALETTE.textSecondary,
    borderColor: theme.colors.other?.divider ?? SANDBOX_DEFAULT_PALETTE.divider,
    accent,
    primarySubtle: theme.colors.primary.subtle ?? SANDBOX_DEFAULT_PALETTE.primarySubtle,
    primaryOutlinedBorder: primaryOutline,
    headerBarBg: theme.colors.primary.main ?? SANDBOX_DEFAULT_PALETTE.primaryMain,
    headerForegroundColor: theme.colors.primary.contrastText ?? '#FFFFFF',
    tabBarBg:
      theme.colors.background.paper ??
      theme.colors.background.default ??
      SANDBOX_DEFAULT_PALETTE.backgroundPaper,
    errorSubtle: theme.colors.error.subtle ?? SANDBOX_DEFAULT_PALETTE.errorSubtle,
    errorSubtleContrast: theme.colors.error.subtleContrast ?? SANDBOX_DEFAULT_PALETTE.errorSubtleContrast,
    infoSubtle: theme.colors.info.subtle ?? SANDBOX_DEFAULT_PALETTE.infoSubtle,
    infoSubtleContrast: theme.colors.info.subtleContrast ?? SANDBOX_DEFAULT_PALETTE.infoSubtleContrast,
    favoriteBorder:
      theme.colors.action?.['active'] ??
      theme.colors.text.secondary ??
      SANDBOX_DEFAULT_PALETTE.textSecondary,
  };
}
