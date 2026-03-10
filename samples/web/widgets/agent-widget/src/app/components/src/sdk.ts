/**
 * SDK Wrapper for BYOA Example
 *
 * This imports the base harness SDK and extends the httpClient
 * to provide realistic financial agent responses for demo purposes.
 */

import {
  HttpResponse,
  HttpRequestConfig,
  HttpClient,
  UserContext,
} from '@cdx-extensions/di-sdk-types';
import { PlatformSDK } from '@cdx-extensions/di-sdk';

// Re-export types and functions from harness SDK
export { PlatformSDK };
export type { HttpResponse, HttpRequestConfig, HttpClient, UserContext };

/**
 * Mock Data Loader
 *
 * Loads mock data from JSON files at runtime
 */
import {
  getAccountData,
  getTransactions,
  getUserPreferences,
  preloadAllMockData,
} from './utils/mockDataLoader';

// Preload mock data on module initialization
preloadAllMockData().catch(error => {
  console.warn('Failed to preload mock data, will use defaults:', error);
});

/** Returns a random number in [0, 1) using crypto.randomUUID(). */
function randomSecure(): number {
  const hex = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return parseInt(hex, 16) / 0x100000000;
}

/**
 * Analyze user message and generate contextual response
 */
async function generateContextualResponse(
  userMessage: string,
  conversationHistory: any[] = [],
  userContext?: { fullName?: string } | null,
): Promise<string> {
  const message = userMessage.toLowerCase();
  // Get user name from context (fallback to 'Alex' if not available)
  const userName = userContext?.fullName?.split(' ')[0] || 'Alex';

  // Get mock data (will use cached or defaults)
  const mockAccountData = getAccountData();
  const mockTransactions = getTransactions();
  const mockUserPreferences = getUserPreferences();

  // Greeting patterns
  if (message.match(/^(hi|hello|hey|greetings)/i)) {
    return `Hello ${userName}! I'm your AI financial assistant. I can help you with:
• Account balances and summaries
• Recent transactions
• Spending analysis
• Savings goals
• Investment insights

What would you like to know?`;
  }

  // Account balance queries
  if (message.match(/balance|how much|account/i)) {
    const totalBalance = mockAccountData.totalBalance.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    const checking = mockAccountData.accounts[0].balance.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    const savings = mockAccountData.accounts[1].balance.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    const investment = mockAccountData.accounts[2].balance.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });

    return `Here's your account summary, ${userName}:

**Total Balance:** ${totalBalance}

**Account Breakdown:**
• Premium Checking (${mockAccountData.accounts[0].accountNumber}): ${checking}
• Savings Account (${mockAccountData.accounts[1].accountNumber}): ${savings}
• Investment Portfolio (${mockAccountData.accounts[2].accountNumber}): ${investment}

All accounts are in good standing. Would you like to see recent transactions or analyze your spending?`;
  }

  // Transaction queries
  if (message.match(/transaction|recent|spending|spent/i)) {
    const recentTransactions = mockTransactions
      .slice(0, 5)
      .map(
        t =>
          `• ${t.date}: ${t.description} - ${t.amount < 0 ? '-' : '+'}$${Math.abs(t.amount).toFixed(2)} (${t.category})`,
      )
      .join('\n');

    return `Here are your 5 most recent transactions, ${userName}:

${recentTransactions}

Your spending this week totals $451.37. The largest expense was groceries at $156.42. Would you like a detailed breakdown by category?`;
  }

  // Savings queries
  if (message.match(/saving|save|goal/i)) {
    const currentSavings = mockAccountData.accounts[1].balance;
    const goal = mockUserPreferences.savingsGoal;
    const progress = ((currentSavings / goal) * 100).toFixed(1);
    const remaining = (goal - currentSavings).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });

    return `Great question about savings, ${userName}! Here's your progress:

**Savings Goal:** $${goal.toLocaleString()}
**Current Savings:** $${currentSavings.toLocaleString()}
**Progress:** ${progress}%
**Remaining:** ${remaining}

You're ${progress}% of the way to your goal! Based on your recent savings pattern of $1,000/month, you'll reach your goal in approximately ${Math.ceil((goal - currentSavings) / 1000)} months.

Would you like suggestions on how to accelerate your savings?`;
  }

  // Investment queries
  if (message.match(/invest|portfolio|stock|market/i)) {
    const investmentBalance = mockAccountData.accounts[2].balance.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });

    return `Here's your investment overview, ${userName}:

**Investment Portfolio Balance:** ${investmentBalance}
**Risk Profile:** ${mockUserPreferences.investmentRiskTolerance}
**YTD Return:** +12.3%

Your portfolio is well-diversified with a moderate risk profile:
• 60% Stocks (index funds)
• 30% Bonds
• 10% Alternative investments

Based on current market conditions and your risk tolerance, your portfolio is performing well. Would you like personalized recommendations or rebalancing suggestions?`;
  }

  // Spending analysis
  if (message.match(/budget|spend.*analysis|category|breakdown/i)) {
    return `Here's your spending breakdown for this month, ${userName}:

**Monthly Budget:** $${mockUserPreferences.monthlyBudget.toLocaleString()}
**Spent So Far:** $451.37 (12.9% of budget)

**Top Categories:**
• Groceries: $156.42 (34.6%)
• Utilities: $145.30 (32.2%)
• Dining: $87.25 (19.3%)
• Transportation: $62.40 (13.8%)

You're tracking well within your budget. At this pace, you'll have $3,048.63 remaining this month. Would you like tips on optimizing your spending?`;
  }

  // Help/capabilities
  if (message.match(/help|what can|can you|capabilities/i)) {
    return `I'm here to help you manage your finances, ${userName}! Here's what I can assist with:

**Account Management:**
• View balances and account summaries
• Track transactions and spending patterns
• Set up alerts and notifications

**Financial Planning:**
• Savings goal tracking and recommendations
• Budget creation and monitoring
• Investment portfolio analysis

**Insights & Analysis:**
• Spending trends and patterns
• Cash flow projections
• Personalized financial advice

Just ask me anything about your accounts, transactions, savings, investments, or budget!`;
  }

  // Thank you
  if (message.match(/thank|thanks|appreciate/i)) {
    return `You're very welcome, ${userName}! I'm always here to help with your financial needs. Feel free to ask me anything else!`;
  }

  // Default contextual response
  const conversationLength = conversationHistory.length;
  const totalBalanceFormatted = mockAccountData.totalBalance.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
  const checkingBalance = mockAccountData.accounts[0]?.balance || 0;
  const savingsBalance = mockAccountData.accounts[1]?.balance || 0;
  const investmentBalance = mockAccountData.accounts[2]?.balance || 0;
  const savingsGoal = mockUserPreferences.savingsGoal;
  const savingsProgress = savingsGoal > 0 ? Math.round((savingsBalance / savingsGoal) * 100) : 0;

  if (conversationLength === 0) {
    return `I understand you're asking about "${userMessage}". Based on your account profile, ${userName}, let me provide you with relevant information.

Your total balance across all accounts is ${totalBalanceFormatted}, and all accounts are in good standing. Is there a specific aspect of your finances you'd like to explore? I can provide details on accounts, transactions, savings, investments, or spending analysis.`;
  } else {
    const checkingFormatted = checkingBalance.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    const savingsFormatted = savingsBalance.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    const investmentFormatted = investmentBalance.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    const goalFormatted = savingsGoal.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });

    return `That's a great question about "${userMessage}", ${userName}.

Based on your financial profile and recent activity, I can help you with that. Your accounts are performing well - you have ${checkingFormatted} in checking, ${savingsFormatted} in savings (${savingsProgress}% toward your ${goalFormatted} goal), and ${investmentFormatted} in investments with a 12.3% YTD return.

Could you be more specific about what you'd like to know? For example:
• Account balances or details
• Recent transactions
• Savings progress
• Investment performance
• Spending analysis`;
  }
}

/**
 * HTTP Client instance implementing HttpClient interface
 * Use this for IDE navigation - cmd+click on methods will navigate to HttpClient interface
 */

const baseHttpClient = PlatformSDK.getInstance().getHttpClient();

export const httpClientWrapper: HttpClient = {
  get: async <T = any>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> => {
    const client = baseHttpClient;
    const response = await client.get<T>(url, config as any);
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as any,
    };
  },
  post: async <T = any>(
    url: string,
    data?: any,
    config?: HttpRequestConfig,
  ): Promise<HttpResponse<T>> => {
    const client = baseHttpClient;
    const response = await client.post<T>(url, data, config as any);
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as any,
    };
  },
  put: async <T = any>(
    url: string,
    data?: any,
    config?: HttpRequestConfig,
  ): Promise<HttpResponse<T>> => {
    const client = baseHttpClient;
    const response = await client.put<T>(url, data, config as any);
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as any,
    };
  },
  patch: async <T = any>(
    url: string,
    data?: any,
    config?: HttpRequestConfig,
  ): Promise<HttpResponse<T>> => {
    const client = baseHttpClient;
    const response = await client.patch<T>(url, data, config as any);
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as any,
    };
  },
  delete: async <T = any>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> => {
    const client = baseHttpClient;
    const response = await client.delete<T>(url, config as any);
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as any,
    };
  },
};

/**
 * Extended HTTP Client for BYOA Example
 *
 * Uses getHttpClientWrapper()  (which internally uses getHttpClient()
 * and adds custom logic for the agent chat endpoint to provide realistic responses.
 */

export const httpClient: HttpClient = {
  get: httpClientWrapper.get,
  put: httpClientWrapper.put,
  patch: httpClientWrapper.patch,
  delete: httpClientWrapper.delete,

  post: async <T = any>(
    url: string,
    data?: any,
    config?: HttpRequestConfig,
  ): Promise<HttpResponse<T>> => {
    // Custom handling for agent chat endpoint
    if (url.includes('/api/agent/chat')) {
      console.log('[httpClient] POST (agent):', url, data);

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000 + randomSecure() * 1000));

      // 5% chance of error for testing
      if (randomSecure() < 0.05) {
        throw {
          response: {
            status: 500,
            data: { error: 'Simulated agent service error' },
          },
          message: 'Agent service temporarily unavailable',
        };
      }

   // Generate contextual response based on user message and conversation history
         const userMessage = data?.message || '';
         const conversationHistory = data?.conversationHistory || [];
         const userContext = data?.userContext;
         const responseText = await generateContextualResponse(userMessage, conversationHistory, userContext);
      // Calculate approximate token count based on response length
      const tokens = Math.floor(responseText.length / 4);

      return {
        data: {
          message: responseText,
          conversationId: data?.conversationId || 'conv-' + Date.now(),
          metadata: {
            model: 'gpt-4-financial-assistant',
            tokens: tokens,
          },
        } as T,
        status: 200,
        statusText: 'OK',
        headers: {},
      };
    }

    // For all other endpoints, use base implementation from httpClient.ts
    return httpClientWrapper.post<T>(url, data, config);
  },
};
