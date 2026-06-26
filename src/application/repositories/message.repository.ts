import type { Message } from "../../domain/entities";

export interface MessageRepository {
  saveMessage(conversationId: string, role: string, content: string | null, toolCalls: string | null): void;
  getMessagesByConversationId(conversationId: string): Message[];
  clearMessages(conversationId: string): void;
}
