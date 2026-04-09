/**
 * Agent Service - mobile
 * Handles conversation with the agent via httpClient (mock contextual responses).
 */

import { httpClient } from '../sdk';
import type {
  AgentConfig,
  AgentError,
  Message,
  SendMessageRequest,
  SendMessageResponse,
  UserContextData,
} from '../types/agent';

export interface UserContext {
  guid?: string;
  fullName?: string;
  email?: string;
  userName?: string;
}

class AgentService {
  private conversationId: string | null = null;
  private conversationHistory: Message[] = [];
  private config: AgentConfig | null = null;
  private userContext: UserContext | null = null;

  async initialize(): Promise<void> {
    this.config = {
      endpoint: '/api/agent/chat',
      model: 'gpt-4',
      maxTokens: 2000,
      temperature: 0.7,
      streaming: false,
    };
  }

  async sendMessage(
    messageText: string,
    options?: Partial<SendMessageRequest>
  ): Promise<Message> {
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
      config: options?.config || this.config || undefined,
    };

    try {
      const response = await httpClient.post<SendMessageResponse>(
        this.config?.endpoint || '/api/agent/chat',
        request,
        { timeout: 30000 }
      );

      if (response.data.conversationId) {
        this.conversationId = response.data.conversationId;
      }

      const agentMessage: Message = {
        id: this.generateMessageId(),
        role: 'agent',
        content: response.data.message,
        timestamp: new Date(),
        metadata: response.data.metadata,
      };
      this.conversationHistory.push(agentMessage);
      return agentMessage;
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      if (e.response?.status === 401) {
        throw this.createAgentError(
          'AUTH_FAILED',
          'Authentication failed. Please refresh and try again.',
          false
        );
      }
      if (e.response?.status === 429) {
        throw this.createAgentError(
          'RATE_LIMIT',
          'Too many requests. Please wait a moment and try again.',
          true
        );
      }
      throw this.createAgentError(
        'AGENT_ERROR',
        (e.message as string) || 'Agent service is temporarily unavailable. Please try again later.',
        true
      );
    }
  }

  private createAgentError(
    code: string,
    message: string,
    retryable: boolean,
    details?: unknown
  ): AgentError {
    return { code, message, retryable, details };
  }

  clearConversation(): void {
    this.conversationId = null;
    this.conversationHistory = [];
  }

  getConversationHistory(): Message[] {
    return [...this.conversationHistory];
  }

  getConversationId(): string | null {
    return this.conversationId;
  }

  async retryLastMessage(): Promise<Message> {
    const lastUserMessage = [...this.conversationHistory]
      .reverse()
      .find((msg) => msg.role === 'user');
    if (!lastUserMessage) {
      throw new Error('No message to retry');
    }

    const lastMessage = this.conversationHistory[this.conversationHistory.length - 1];
    const secondLastMessage = this.conversationHistory[this.conversationHistory.length - 2];
    let messagesToRemove = 1;
    if (
      lastMessage?.role === 'agent' &&
      secondLastMessage?.role === 'user' &&
      secondLastMessage.id === lastUserMessage.id
    ) {
      messagesToRemove = 2;
    } else if (
      lastMessage?.id === lastUserMessage.id &&
      lastMessage?.role === 'user'
    ) {
      messagesToRemove = 1;
    }
    this.conversationHistory = this.conversationHistory.slice(
      0,
      -messagesToRemove
    );
    return this.sendMessage(lastUserMessage.content);
  }

  setUserContext(context: UserContext): void {
    this.userContext = context;
  }

  private async getUserContextData(): Promise<UserContextData> {
    const userContext = this.userContext;
    if (!userContext) {
      return {
        userId: 'unknown',
        fullName: 'User',
        email: '',
      };
    }
    return {
      userId: userContext.guid || 'unknown',
      fullName: userContext.fullName || 'User',
      email: userContext.email || '',
    };
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

export const agentService = new AgentService();
