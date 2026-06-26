import type { Database } from "bun:sqlite";
import type { UserRepository } from "../../application/repositories/user.repository";
import type { ConversationRepository } from "../../application/repositories/conversation.repository";
import type { MessageRepository } from "../../application/repositories/message.repository";
import type { User, Conversation, Message } from "../../domain/entities";

export class SqliteUserRepository implements UserRepository {
  constructor(private db: Database) {}

  createUser(username: string, passwordHash: string): void {
    const query = this.db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)");
    query.run(username, passwordHash);
  }

  getUserByUsername(username: string): User | null {
    const query = this.db.prepare("SELECT * FROM users WHERE username = ?");
    const result = query.get(username) as any;
    return result || null;
  }

  getUserById(id: number): User | null {
    const query = this.db.prepare("SELECT * FROM users WHERE id = ?");
    const result = query.get(id) as any;
    return result || null;
  }

  updateUserApiKey(userId: number, apiKey: string): void {
    const query = this.db.prepare("UPDATE users SET gemini_api_key = ? WHERE id = ?");
    query.run(apiKey, userId);
  }

  updateUserOpenAIConfig(userId: number, provider: string, apiKey: string, baseUrl: string, model: string): void {
    const query = this.db.prepare("UPDATE users SET provider = ?, openai_api_key = ?, openai_base_url = ?, openai_model = ? WHERE id = ?");
    query.run(provider, apiKey, baseUrl, model, userId);
  }

  updateUserProvider(userId: number, provider: string): void {
    const query = this.db.prepare("UPDATE users SET provider = ? WHERE id = ?");
    query.run(provider, userId);
  }
}

export class SqliteConversationRepository implements ConversationRepository {
  constructor(private db: Database) {}

  createConversation(id: string, userId: number, title: string, folderId: string | null, folderName: string | null): void {
    const query = this.db.prepare(`
      INSERT INTO conversations (id, user_id, title, folder_id, folder_name) 
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET 
        title = excluded.title,
        folder_id = excluded.folder_id,
        folder_name = excluded.folder_name
    `);
    query.run(id, userId, title, folderId, folderName);
  }

  getConversationsByUserId(userId: number): Conversation[] {
    const query = this.db.prepare("SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC");
    return query.all(userId) as Conversation[];
  }

  deleteConversation(id: string, userId: number): void {
    const query = this.db.prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?");
    query.run(id, userId);
  }

  updateConversationTitle(id: string, title: string, userId: number): void {
    const query = this.db.prepare("UPDATE conversations SET title = ? WHERE id = ? AND user_id = ?");
    query.run(title, id, userId);
  }

  getConversationById(id: string, userId: number): Conversation | null {
    const query = this.db.prepare("SELECT * FROM conversations WHERE id = ? AND user_id = ?");
    const result = query.get(id, userId) as Conversation;
    return result || null;
  }
}

export class SqliteMessageRepository implements MessageRepository {
  constructor(private db: Database) {}

  saveMessage(conversationId: string, role: string, content: string | null, toolCalls: string | null): void {
    const query = this.db.prepare("INSERT INTO messages (conversation_id, role, content, tool_calls) VALUES (?, ?, ?, ?)");
    query.run(conversationId, role, content, toolCalls);
  }

  getMessagesByConversationId(conversationId: string): Message[] {
    const query = this.db.prepare("SELECT role, content, tool_calls FROM messages WHERE conversation_id = ? ORDER BY id ASC");
    const msgs = query.all(conversationId) as any[];
    return msgs.map(m => ({
      role: m.role,
      content: m.content,
      toolCalls: m.tool_calls ? JSON.parse(m.tool_calls) : null
    }));
  }

  clearMessages(conversationId: string): void {
    const query = this.db.prepare("DELETE FROM messages WHERE conversation_id = ?");
    query.run(conversationId);
  }
}
