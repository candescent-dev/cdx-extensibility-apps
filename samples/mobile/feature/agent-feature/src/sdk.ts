/**
 * SDK and HTTP client for mobile agent feature.
 * Provides mock agent responses via generateContextualResponse (same logic as web).
 */

import { PlatformSDK } from '@cdx-extensions/di-sdk';
import type { Message } from './types/agent';
import {
  getAccountData,
  getTransactions,
  getUserPreferences,
} from './utils/mockData';

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers?: Record<string, string>;
}

export interface HttpRequestConfig {
  timeout?: number;
  headers?: Record<string, string>;
}

export interface HttpClient {
  get<T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>>;
  put<T = unknown>(
    url: string,
    data?: unknown,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>>;
  patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>>;
  delete<T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
}

async function generateContextualResponse(
  userMessage: string,
  conversationHistory: Message[] = [],
  userContext?: { fullName?: string } | null
): Promise<string> {
  const message = userMessage.toLowerCase();
  const userName = userContext?.fullName?.split(' ')[0] || 'Alex';
  const mockAccountData = getAccountData();
  const mockTransactions = getTransactions();
  const mockUserPreferences = getUserPreferences();

  if (message.match(/^(hi|hello|hey|greetings)/i)) {
    return `Hello ${userName}! I'm your AI financial assistant. I can help you with:
• Account balances and summaries
• Recent transactions
• Spending analysis
• Savings goals
• Investment insights

What would you like to know?`;
  }

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

  if (message.match(/transaction|recent|spending|spent/i)) {
    const recentTransactions = mockTransactions
      .slice(0, 5)
      .map(
        (t) =>
          `• ${t.date}: ${t.description} - ${t.amount < 0 ? '-' : '+'}$${Math.abs(t.amount).toFixed(2)} (${t.category})`
      )
      .join('\n');
    return `Here are your 5 most recent transactions, ${userName}:

${recentTransactions}

Your spending this week totals $451.37. The largest expense was groceries at $156.42. Would you like a detailed breakdown by category?`;
  }

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

  if (message.match(/thank|thanks|appreciate/i)) {
    return `You're very welcome, ${userName}! I'm always here to help with your financial needs. Feel free to ask me anything else!`;
  }

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
  }

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

/**
 * HTTP Client instance implementing HttpClient interface
 * Use this for IDE navigation - cmd+click on methods will navigate to HttpClient interface
 *
 * Lazy-initialized to avoid calling PlatformSDK.getInstance() at module load time
 * (before PlatformSDK.init() runs in bootstrap).
 */
function getBaseHttpClient() {
  return PlatformSDK.getInstance().getHttpClient();
}

const httpClientWrapper: HttpClient = {
  get: async <T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> => {
    const client = getBaseHttpClient();
    const response = await client.get<T>(url, config);
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string> | undefined,
    };
  },
  post: async <T = unknown>(
    url: string,
    data?: unknown,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>> => {
    const client = getBaseHttpClient();
    const response = await client.post<T>(url, data, config);
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string> | undefined,
    };
  },
  put: async <T = unknown>(
    url: string,
    data?: unknown,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>> => {
    const client = getBaseHttpClient();
    const response = await client.put<T>(url, data, config);
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string> | undefined,
    };
  },
  patch: async <T = unknown>(
    url: string,
    data?: unknown,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>> => {
    const client = getBaseHttpClient();
    const response = await client.patch<T>(url, data, config);
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string> | undefined,
    };
  },
  delete: async <T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> => {
    const client = getBaseHttpClient();
    const response = await client.delete<T>(url, config);
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string> | undefined,
    };
  },
};

/**
 * Mobile httpClient: uses platform client (getBaseHttpClient) for all requests except
 * POST /api/agent/chat, which returns mock contextual responses.
 */
export const httpClient: HttpClient = {
  get: httpClientWrapper.get,
  put: httpClientWrapper.put,
  patch: httpClientWrapper.patch,
  delete: httpClientWrapper.delete,

  post: async <T = unknown>(
    url: string,
    data?: unknown,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>> => {
    if (url.includes('/api/agent/chat')) {
      const body = data as {
        message?: string;
        conversationHistory?: Message[];
        userContext?: { fullName?: string };
        conversationId?: string;
      };
      const userMessage = body?.message || '';
      const conversationHistory = body?.conversationHistory || [];
      const userContext = body?.userContext;

      await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));

      if (Math.random() < 0.05) {
        throw Object.assign(new Error('Agent service temporarily unavailable'), {
          response: { status: 500, data: { error: 'Simulated agent service error' } },
        });
      }

      const responseText = await generateContextualResponse(
        userMessage,
        conversationHistory,
        userContext
      );
      const tokens = Math.floor(responseText.length / 4);

      return {
        data: {
          message: responseText,
          conversationId: body?.conversationId || 'conv-' + Date.now(),
          metadata: {
            model: 'gpt-4-financial-assistant',
            tokens,
          },
        } as T,
        status: 200,
        statusText: 'OK',
        headers: {},
      };
    }

    return httpClientWrapper.post<T>(url, data, config);
  },
};
