/**
 * Synthetic account model for the mobile sandbox only.
 * Demo ordering and balances for layout testing (not live API data).
 */
export type AccountStatusBadge =
  | { variant: 'error'; text: string }
  | { variant: 'info'; text: string };

/** Two-column row (credit / line of credit): e.g. Outstanding + Available credit */
export type SandboxAccountCredit = {
  id: string;
  layout: 'credit_two_col';
  displayName: string;
  maskedNumber: string;
  favorite: boolean;
  leftLabel: string;
  leftAmount: number;
  rightLabel: string;
  rightAmount: number;
  statusBadge?: AccountStatusBadge;
};

/** Single balance + one primary CTA (investment: Statements; checking/savings: Transfer) */
export type SandboxAccountSingle = {
  id: string;
  layout: 'single_balance';
  displayName: string;
  maskedNumber: string;
  favorite: boolean;
  balanceLabel: string;
  balance: number;
  primaryAction: 'Statements' | 'Transfer';
};

export type SandboxAccount = SandboxAccountCredit | SandboxAccountSingle;

export const MOCK_ACCOUNTS: SandboxAccount[] = [
  {
    id: '1',
    layout: 'credit_two_col',
    displayName: 'Credit Card',
    maskedNumber: '*12345',
    favorite: false,
    leftLabel: 'Outstanding balance',
    leftAmount: 6789.12,
    rightLabel: 'Available credit',
    rightAmount: 1210.88,
    statusBadge: { variant: 'error', text: 'Past due $354.27' },
  },
  {
    id: '2',
    layout: 'credit_two_col',
    displayName: 'Line of credit',
    maskedNumber: '*12345',
    favorite: true,
    leftLabel: 'Balance',
    leftAmount: 827.12,
    rightLabel: 'Available credit',
    rightAmount: 1203.76,
    statusBadge: { variant: 'info', text: 'Due 12/01/2024' },
  },
  {
    id: '3',
    layout: 'single_balance',
    displayName: 'Investment',
    maskedNumber: '*12345',
    favorite: false,
    balanceLabel: 'Available balance',
    balance: 4520.8,
    primaryAction: 'Statements',
  },
  {
    id: '4',
    layout: 'single_balance',
    displayName: 'Checking',
    maskedNumber: '*12345',
    favorite: true,
    balanceLabel: 'Available balance',
    balance: 756.93,
    primaryAction: 'Transfer',
  },
  {
    id: '5',
    layout: 'single_balance',
    displayName: 'Emergency Fund',
    maskedNumber: '*12345',
    favorite: false,
    balanceLabel: 'Available balance',
    balance: 10000.0,
    primaryAction: 'Transfer',
  },
];
