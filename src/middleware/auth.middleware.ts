import type { MiddlewareHandler } from "hono";
import type { SessionManager } from "../application/usecases/auth.usecase";

export function createAuthMiddleware(sessionManager: SessionManager): MiddlewareHandler {
  return async (c, next) => {
    // Exclude auth routes (like register and login)
    const path = c.req.path;
    if (path === '/api/auth/register' || path === '/api/auth/login') {
      await next();
      return;
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const token = authHeader.substring(7);
    const userId = sessionManager.getUserId(token);
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    c.set('userId', userId);
    await next();
  };
}
