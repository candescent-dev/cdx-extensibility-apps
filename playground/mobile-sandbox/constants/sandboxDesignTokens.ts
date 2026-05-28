/** Fallback palette and shadows when `BrandingContext` omits specific color roles. */
export const SANDBOX_DEFAULT_PALETTE = {
  primaryMain: '#1A6CDA',
  primarySubtle: '#D5ECFC',
  primaryOutlinedBorder: 'rgba(26, 108, 218, 0.5)',
  backgroundDefault: '#FAFAFA',
  backgroundPaper: '#FFFFFF',
  textPrimary: '#212121',
  textSecondary: '#656565',
  /** FDIC disclosure wordmark + italic copy — dark navy (matches common FDIC digital / footer styling). */
  fdicDisclosureInk: '#002147',
  divider: '#E0E0E0',
  errorSubtle: '#FCE3E4',
  errorSubtleContrast: '#5B0A0D',
  infoSubtle: '#E5E8FC',
  infoSubtleContrast: '#1A236A',
  fabShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
  },
  contentCardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;
