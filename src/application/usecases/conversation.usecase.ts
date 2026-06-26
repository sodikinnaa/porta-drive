import type { ConversationRepository } from "../repositories/conversation.repository";
import type { MessageRepository } from "../repositories/message.repository";
import type { Conversation, Message } from "../../domain/entities";

export class ConversationUseCase {
  constructor(
    private conversationRepository: ConversationRepository,
    private messageRepository: MessageRepository
  ) {}

  createConversation(id: string, userId: number, title: string, folderId: string | null, folderName: string | null): void {
    this.conversationRepository.createConversation(id, userId, title, folderId, folderName);
  }

  getConversationsByUserId(userId: number): Conversation[] {
    return this.conversationRepository.getConversationsByUserId(userId);
  }

  deleteConversation(id: string, userId: number): void {
    this.conversationRepository.deleteConversation(id, userId);
  }

  getMessagesByConversationId(conversationId: string): Message[] {
    return this.messageRepository.getMessagesByConversationId(conversationId);
  }
}
