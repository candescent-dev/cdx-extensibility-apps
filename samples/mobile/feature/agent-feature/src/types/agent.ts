/**
 * Type definitions for Bring Your Own Agent (BYOA) - mobile
 */

export interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  tokens?: number;
  model?: string;
  confidence?: number;
  sources?: string[];
  suggestedActions?: SuggestedAction[];
}

export interface SuggestedAction {
  type: 'navigate' | 'openModal' | 'makeApiCall' | 'custom';
  label: string;
  payload: unknown;
  endpoint?: string;
}

export interface AgentConfig {
  endpoint: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  streaming?: boolean;
}

export interface SendMessageRequest {
  message: string;
  conversationId?: string;
  conversationHistory?: Message[];
  userContext?: UserContextData;
  config?: Partial<AgentConfig>;
}

export interface SendMessageResponse {
  message: string;
  conversationId: string;
  metadata?: MessageMetadata;
  error?: string;
}

export interface UserContextData {
  userId: string;
  fullName: string;
  email: string;
  accountType?: string;
  preferences?: Record<string, unknown>;
}

export interface ConversationState {
  conversationId: string;
  messages: Message[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentError {
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
}

export type AgentStatus = 'idle' | 'thinking' | 'responding' | 'error';
