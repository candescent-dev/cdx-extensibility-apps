/**
 * Inline mock data for mobile (no JSON file imports)
 */

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  accountNumber: string;
  status: string;
}

export interface AccountData {
  accounts: Account[];
  totalBalance: number;
}

export interface Transaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  account: string;
}

export interface UserPreferences {
  savingsGoal: number;
  monthlyBudget: number;
  investmentRiskTolerance: string;
}

export const DEFAULT_ACCOUNT_DATA: AccountData = {
  accounts: [
    {
      id: 'acc-001',
      name: 'Premium Checking',
      type: 'checking',
      balance: 12458.32,
      accountNumber: '****3847',
      status: 'active',
    },
    {
      id: 'acc-002',
      name: 'Savings Account',
      type: 'savings',
      balance: 45230.18,
      accountNumber: '****7621',
      status: 'active',
    },
    {
      id: 'acc-003',
      name: 'Investment Portfolio',
      type: 'investment',
      balance: 128500.0,
      accountNumber: '****9402',
      status: 'active',
    },
  ],
  totalBalance: 186188.5,
};

export const DEFAULT_TRANSACTIONS: Transaction[] = [
  {
    date: '2025-11-03',
    description: 'Grocery Store',
    amount: -156.42,
    category: 'groceries',
    account: 'Premium Checking',
  },
  {
    date: '2025-11-02',
    description: 'Salary Deposit',
    amount: 5200.0,
    category: 'income',
    account: 'Premium Checking',
  },
  {
    date: '2025-11-01',
    description: 'Electric Bill',
    amount: -145.3,
    category: 'utilities',
    account: 'Premium Checking',
  },
  {
    date: '2025-10-31',
    description: 'Restaurant',
    amount: -87.25,
    category: 'dining',
    account: 'Premium Checking',
  },
  {
    date: '2025-10-30',
    description: 'Gas Station',
    amount: -62.4,
    category: 'transportation',
    account: 'Premium Checking',
  },
  {
    date: '2025-10-28',
    description: 'Transfer to Savings',
    amount: -1000.0,
    category: 'transfer',
    account: 'Premium Checking',
  },
  {
    date: '2025-10-28',
    description: 'Transfer from Checking',
    amount: 1000.0,
    category: 'transfer',
    account: 'Savings Account',
  },
];

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  savingsGoal: 50000,
  monthlyBudget: 3500,
  investmentRiskTolerance: 'moderate',
};

export function getAccountData(): AccountData {
  return DEFAULT_ACCOUNT_DATA;
}

export function getTransactions(): Transaction[] {
  return DEFAULT_TRANSACTIONS;
}

export function getUserPreferences(): UserPreferences {
  return DEFAULT_USER_PREFERENCES;
}
