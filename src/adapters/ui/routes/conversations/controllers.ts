import type { Context } from "hono";
import type { BaseController } from "../base.controller";
import type { ConversationUseCase } from "../../../../application/usecases/conversation.usecase";

export class ListConversationsController implements BaseController {
  constructor(private conversationUseCase: ConversationUseCase) {}

  async main(c: Context): Promise<Response> {
    const userId = c.get('userId');
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    try {
      const list = this.conversationUseCase.getConversationsByUserId(userId);
      return c.json({ success: true, conversations: list });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  }
}

export class CreateConversationController implements BaseController {
  constructor(private conversationUseCase: ConversationUseCase) {}

  async main(c: Context): Promise<Response> {
    const userId = c.get('userId');
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    try {
      const { id, title, folderId, folderName } = await c.req.json();
      if (!id || !title) {
        return c.json({ error: 'Conversation ID and title are required' }, 400);
      }
      this.conversationUseCase.createConversation(id, userId, title, folderId, folderName);
      return c.json({ success: true });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  }
}

export class DeleteConversationController implements BaseController {
  constructor(private conversationUseCase: ConversationUseCase) {}

  async main(c: Context): Promise<Response> {
    const userId = c.get('userId');
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    try {
      const { id } = await c.req.json();
      if (!id) return c.json({ error: 'Conversation ID is required' }, 400);
      
      this.conversationUseCase.deleteConversation(id, userId);
      return c.json({ success: true });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  }
}

export class GetMessagesController implements BaseController {
  constructor(private conversationUseCase: ConversationUseCase) {}

  async main(c: Context): Promise<Response> {
    const userId = c.get('userId');
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    try {
      const { id } = await c.req.json();
      if (!id) return c.json({ error: 'Conversation ID is required' }, 400);

      const messages = this.conversationUseCase.getMessagesByConversationId(id);
      return c.json({ success: true, messages });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  }
}
