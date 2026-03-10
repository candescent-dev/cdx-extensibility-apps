/**
 * Mock Data Loader Utility
 *
 * Loads mock data from JSON files at runtime and provides caching
 * to avoid repeated network requests.
 */
import accountDataJson from '../../mocks/accountData.json';
import transactionsJson from '../../mocks/transactions.json';
import userPreferencesJson from '../../mocks/userPreferences.json';

// Type Definitions
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

// Default fallback data (matches original hardcoded values)
const DEFAULT_ACCOUNT_DATA: AccountData = {
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
      balance: 128500.00,
      accountNumber: '****9402',
      status: 'active',
    },
  ],
  totalBalance: 186188.50,
};

const DEFAULT_TRANSACTIONS: Transaction[] = [
  { date: '2025-11-03', description: 'Grocery Store', amount: -156.42, category: 'groceries', account: 'Premium Checking' },
  { date: '2025-11-02', description: 'Salary Deposit', amount: 5200.00, category: 'income', account: 'Premium Checking' },
  { date: '2025-11-01', description: 'Electric Bill', amount: -145.30, category: 'utilities', account: 'Premium Checking' },
  { date: '2025-10-31', description: 'Restaurant', amount: -87.25, category: 'dining', account: 'Premium Checking' },
  { date: '2025-10-30', description: 'Gas Station', amount: -62.40, category: 'transportation', account: 'Premium Checking' },
  { date: '2025-10-28', description: 'Transfer to Savings', amount: -1000.00, category: 'transfer', account: 'Premium Checking' },
  { date: '2025-10-28', description: 'Transfer from Checking', amount: 1000.00, category: 'transfer', account: 'Savings Account' },
];

const DEFAULT_USER_PREFERENCES: UserPreferences = {
  savingsGoal: 50000,
  monthlyBudget: 3500,
  investmentRiskTolerance: 'moderate',
};

// Cache for loaded data
let cachedAccountData: AccountData | null = null;
let cachedTransactions: Transaction[] | null = null;
let cachedUserPreferences: UserPreferences | null = null;

// Loading promises to prevent duplicate fetches
let accountDataPromise: Promise<AccountData> | null = null;
let transactionsPromise: Promise<Transaction[]> | null = null;
let userPreferencesPromise: Promise<UserPreferences> | null = null;

/**
 * Fetch JSON file and parse it
 */
async function fetchJson<T>(url: string, defaultValue: T): Promise<T> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const data = await response.json();
    return data as T;
  } catch (error) {
    console.warn(`Failed to load mock data from ${url}, using defaults:`, error);
    return defaultValue;
  }
}

/**
 * Load account data from JSON file
 */
export async function loadAccountData(): Promise<AccountData> {
  if (cachedAccountData) {
    return cachedAccountData;
  }
  cachedAccountData = accountDataJson as AccountData;
  return cachedAccountData;
}

/**
 * Load transactions from JSON file
 */
export async function loadTransactions(): Promise<Transaction[]> {
  if (cachedTransactions) {
    return cachedTransactions;
  }

  cachedTransactions = transactionsJson as Transaction[];
  return cachedTransactions;
}

/**
 * Load user preferences from JSON file
 */
export async function loadUserPreferences(): Promise<UserPreferences> {
  if (cachedUserPreferences) {
    return cachedUserPreferences;
  }
  cachedUserPreferences = userPreferencesJson as UserPreferences;
  return cachedUserPreferences;
}

/**
 * Get account data (returns cached or default if not loaded yet)
 */
export function getAccountData(): AccountData {
  return cachedAccountData || DEFAULT_ACCOUNT_DATA;
}

/**
 * Get transactions (returns cached or default if not loaded yet)
 */
export function getTransactions(): Transaction[] {
  return cachedTransactions || DEFAULT_TRANSACTIONS;
}

/**
 * Get user preferences (returns cached or default if not loaded yet)
 */
export function getUserPreferences(): UserPreferences {
  return cachedUserPreferences || DEFAULT_USER_PREFERENCES;
}

/**
 * Preload all mock data files
 */
export async function preloadAllMockData(): Promise<void> {
  await Promise.all([
    loadAccountData(),
    loadTransactions(),
    loadUserPreferences(),
  ]);
}

/**
 * Clear cache (useful for testing or reloading data)
 */
export function clearCache(): void {
  cachedAccountData = null;
  cachedTransactions = null;
  cachedUserPreferences = null;
  accountDataPromise = null;
  transactionsPromise = null;
  userPreferencesPromise = null;
}

