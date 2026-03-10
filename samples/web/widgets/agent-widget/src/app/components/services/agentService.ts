/**
 * Agent Service
 *
 * Handles communication with the agent backend through the platform's httpClient.
 * This ensures secure, authenticated requests with proper user context.
 */

import { httpClient } from '../src/sdk';
import type { UserContext } from '../src/sdk';
import type {
  AgentConfig,
  AgentError,
  Message,
  SendMessageRequest,
  SendMessageResponse,
  UserContextData,
} from '../types/agent';

class AgentService {
  private conversationId: string | null = null;
  private conversationHistory: Message[] = [];
  private config: AgentConfig | null = null;
  private userContext: UserContext | null = null;

  /**
   * Initialize the agent service with configuration
   */
  async initialize(): Promise<void> {
    try {
      const platformConfig = this.getConfig();

      // Get agent configuration from platform
      this.config = {
        endpoint: '/api/agent/chat',
        model: platformConfig.customSettings?.agentModel || 'gpt-4',
        maxTokens: platformConfig.customSettings?.maxTokens || 2000,
        temperature: platformConfig.customSettings?.temperature || 0.7,
        streaming: platformConfig.customSettings?.streaming || false,
      };

      console.log('Agent service initialized with config:', this.config);
    } catch (error) {
      console.error('Failed to initialize agent service:', error);
      throw error;
    }
  }

  /**
   * Send a message to the agent and get a response
   */
  async sendMessage(messageText: string, options?: Partial<SendMessageRequest>): Promise<Message> {
    try {
      // Get user context for personalization
      const userContext = await this.getUserContextData();

      // Create user message
      const userMessage: Message = {
        id: this.generateMessageId(),
        role: 'user',
        content: messageText,
        timestamp: new Date(),
      };

      // Add to history
      this.conversationHistory.push(userMessage);

      // Prepare request
      const request: SendMessageRequest = {
        message: messageText,
        conversationId: this.conversationId || undefined,
        conversationHistory: this.conversationHistory.slice(-10), // Last 10 messages
        userContext,
        config: options?.config || this.config || undefined,
      };

      // Send to backend
      const response = await httpClient.post<SendMessageResponse>(
        this.config?.endpoint || '/api/agent/chat',
        request,
        {
          timeout: 30000, // 30 second timeout
        },
      );

      // Update conversation ID
      if (response.data.conversationId) {
        this.conversationId = response.data.conversationId;
      }

      // Create agent message
      const agentMessage: Message = {
        id: this.generateMessageId(),
        role: 'agent',
        content: response.data.message,
        timestamp: new Date(),
        metadata: response.data.metadata,
      };

      // Add to history
      this.conversationHistory.push(agentMessage);

      return agentMessage;
    } catch (error: any) {
      console.error('Error sending message to agent:', error);

      // Handle specific error cases
      if (error.response?.status === 401) {
        throw this.createAgentError(
          'AUTH_FAILED',
          'Authentication failed. Please refresh and try again.',
          false,
        );
      }
      if (error.response?.status === 429) {
        throw this.createAgentError(
          'RATE_LIMIT',
          'Too many requests. Please wait a moment and try again.',
          true,
        );
      }
      if (error.code === 'ECONNABORTED') {
        throw this.createAgentError('TIMEOUT', 'Request timed out. Please try again.', true);
      }
      throw this.createAgentError(
        'AGENT_ERROR',
        'Agent service is temporarily unavailable. Please try again later.',
        true,
      );
    }
  }

  /**
   * Send a message with streaming response
   * Note: Requires backend support for server-sent events
   */
  async sendMessageStream(
    messageText: string,
    onChunk: (chunk: string) => void,
    onComplete: (message: Message) => void,
    onError: (error: AgentError) => void,
  ): Promise<void> {
    try {
      const userContext = await this.getUserContextData();

      const userMessage: Message = {
        id: this.generateMessageId(),
        role: 'user',
        content: messageText,
        timestamp: new Date(),
      };

      this.conversationHistory.push(userMessage);

      const request: SendMessageRequest = {
        message: messageText,
        conversationId: this.conversationId || undefined,
        conversationHistory: this.conversationHistory.slice(-10),
        userContext,
        config: { ...this.config, streaming: true },
      };

      // Make streaming request
      const response = await httpClient.post(
        `${this.config?.endpoint || '/api/agent/chat'}/stream`,
        request,
        {
          responseType: 'stream',
        },
      );

      let fullResponse = '';

      // Handle stream (implementation depends on backend format)
      // This is a simplified example
      const reader = response.data.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;
        onChunk(chunk);
      }

      const agentMessage: Message = {
        id: this.generateMessageId(),
        role: 'agent',
        content: fullResponse,
        timestamp: new Date(),
      };

      this.conversationHistory.push(agentMessage);
      onComplete(agentMessage);
    } catch (error: any) {
      onError(this.createAgentError('STREAM_ERROR', error.message, true));
    }
  }

  /**
   * Clear conversation history and start new conversation
   */
  clearConversation(): void {
    this.conversationId = null;
    this.conversationHistory = [];
  }

  /**
   * Get current conversation history
   */
  getConversationHistory(): Message[] {
    return [...this.conversationHistory];
  }

  /**
   * Get conversation ID
   */
  getConversationId(): string | null {
    return this.conversationId;
  }

  /**
   * Retry last message (useful for error recovery)
   */
  async retryLastMessage(): Promise<Message> {
    const lastUserMessage = [...this.conversationHistory]
      .reverse()
      .find(msg => msg.role === 'user');

    if (!lastUserMessage) {
      throw new Error('No message to retry');
    }

    // Determine how many messages to remove based on what's actually in history
    // If the API call failed before adding an agent response, only the user message exists
    // If the API call succeeded, both user and agent messages exist
    const lastMessage = this.conversationHistory[this.conversationHistory.length - 1];
    const secondLastMessage = this.conversationHistory[this.conversationHistory.length - 2];

    let messagesToRemove = 1; // At minimum, remove the user message
    if (
      lastMessage?.role === 'agent' &&
      secondLastMessage?.role === 'user' &&
      secondLastMessage.id === lastUserMessage.id
    ) {
      // Both user and agent messages exist (API call succeeded), remove both
      messagesToRemove = 2;
    } else if (lastMessage?.id === lastUserMessage.id && lastMessage?.role === 'user') {
      // Only the user message exists (API call failed before agent response), remove only 1
      messagesToRemove = 1;
    }

    // Remove the appropriate number of messages from the end
    this.conversationHistory = this.conversationHistory.slice(0, -messagesToRemove);

    // Resend
    return this.sendMessage(lastUserMessage.content);
  }

  /**
   * Set user context from component (called when hook data is available)
   * @param context - User context from useUserContext() hook
   */
  setUserContext(context: UserContext): void {
    this.userContext = context;
  }

  /**
   * Get user context data for agent personalization
   * Uses cached user context if available, otherwise fetches it
   */
  private async getUserContextData(): Promise<UserContextData> {
    try {
      // Use cached user context if available (from component hook)
      const userContext = this.userContext;

      if (!userContext) {
        // If user context not yet set from hook, return minimal context
        console.warn('User context not yet available from useUserContext hook');
        const config = this.getConfig();
        return {
          userId: 'unknown',
          fullName: 'User',
          email: '',
          accountType: config.customSettings?.accountType,
          preferences: config.customSettings?.userPreferences,
        };
      }

      const config = this.getConfig();

      return {
        userId: userContext.guid,
        fullName: userContext.fullName,
        email: userContext.email,
        accountType: config.customSettings?.accountType,
        preferences: config.customSettings?.userPreferences,
      };
    } catch (error) {
      console.error('Failed to get user context:', error);
      // Return minimal context
      return {
        userId: 'unknown',
        fullName: 'User',
        email: '',
      };
    }
  }

  /**
   * Generate unique message ID using cryptographically secure random values
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 9)}`;
  }

  /**
   * Get platform configuration
   *
   * Returns mock platform configuration data for development/testing purposes.
   * In production, this would fetch actual configuration from the platform.
   */
  private getConfig() {
    return {
      environment: 'dev' as const,
      apiBaseUrl: 'https://example.com/digital-banking',
      features: {
        newFeatureEnabled: true,
        advancedSearch: true,
        notifications: true,
      },
      customSettings: {
        theme: 'light',
        language: 'en-US',
        // Agent-specific settings
        agentModel: 'gpt-4',
        maxTokens: 2000,
        temperature: 0.7,
        streaming: false,
        // User context settings
        accountType: undefined,
        userPreferences: undefined,
      },
    };
  }

  /**
   * Create structured agent error
   */
  private createAgentError(
    code: string,
    message: string,
    retryable: boolean,
    details?: any,
  ): AgentError {
    return {
      code,
      message,
      retryable,
      details,
    };
  }
}

// Export singleton instance
export const agentService = new AgentService();
