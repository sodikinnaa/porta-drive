import type { Conversation } from "../../domain/entities";

export interface ConversationRepository {
  createConversation(id: string, userId: number, title: string, folderId: string | null, folderName: string | null): void;
  getConversationsByUserId(userId: number): Conversation[];
  deleteConversation(id: string, userId: number): void;
  updateConversationTitle(id: string, title: string, userId: number): void;
  getConversationById(id: string, userId: number): Conversation | null;
}
