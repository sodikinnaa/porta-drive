import type { Context } from "hono";
import type { BaseController } from "../base.controller";
import type { ChatUseCase } from "../../../../application/usecases/chat.usecase";

export class ChatController implements BaseController {
  constructor(private chatUseCase: ChatUseCase) {}

  async main(c: Context): Promise<Response> {
    const userId = c.get('userId');
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    try {
      const { conversationId, message, folderId, folderStructure, modelName } = await c.req.json();
      if (!conversationId || !message) {
        return c.json({ error: 'Conversation ID and message are required' }, 400);
      }

      const result = await this.chatUseCase.executeChat(
        userId,
        conversationId,
        message,
        folderId || '',
        folderStructure || [],
        modelName
      );

      return c.json({ text: result.text, toolCalls: result.toolCalls });
    } catch (err: any) {
      console.error("Chat Controller Error:", err);
      return c.json({ error: err.message }, 500);
    }
  }
}

export class ModelsController implements BaseController {
  constructor(private chatUseCase: ChatUseCase) {}

  async main(c: Context): Promise<Response> {
    const userId = c.get('userId');
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    try {
      const result = await this.chatUseCase.fetchAvailableModels(userId);
      return c.json({ provider: result.provider, models: result.models });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  }
}

export class TestConfigController implements BaseController {
  constructor(private chatUseCase: ChatUseCase) {}

  async main(c: Context): Promise<Response> {
    const userId = c.get('userId');
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    try {
      const { provider, geminiApiKey, openaiApiKey, openaiBaseUrl } = await c.req.json();
      const result = await this.chatUseCase.testConnection(
        userId,
        provider,
        geminiApiKey,
        openaiApiKey,
        openaiBaseUrl
      );
      
      return c.json(result);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  }
}
