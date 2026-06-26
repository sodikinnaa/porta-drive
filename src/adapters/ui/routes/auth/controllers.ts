import type { Context } from "hono";
import type { BaseController } from "../base.controller";
import type { AuthUseCase } from "../../../../application/usecases/auth.usecase";

export class RegisterController implements BaseController {
  constructor(private authUseCase: AuthUseCase) {}

  async main(c: Context): Promise<Response> {
    try {
      const { username, password } = await c.req.json();
      if (!username || !password) {
        return c.json({ error: 'Username and password are required' }, 400);
      }
      
      const hash = await Bun.password.hash(password);
      await this.authUseCase.register(username, hash);
      return c.json({ success: true, message: 'Registration successful' });
    } catch (err: any) {
      if (err.message === "Username already exists") {
        return c.json({ error: err.message }, 409);
      }
      return c.json({ error: err.message }, 500);
    }
  }
}

export class LoginController implements BaseController {
  constructor(private authUseCase: AuthUseCase) {}

  async main(c: Context): Promise<Response> {
    try {
      const { username, password } = await c.req.json();
      if (!username || !password) {
        return c.json({ error: 'Username and password are required' }, 400);
      }

      const result = await this.authUseCase.login(username, password);
      return c.json({
        success: true,
        token: result.token,
        username: result.user.username,
        provider: result.user.provider || 'gemini',
        geminiApiKey: result.user.gemini_api_key || '',
        openaiApiKey: result.user.openai_api_key || '',
        openaiBaseUrl: result.user.openai_base_url || '',
        openaiModel: result.user.openai_model || ''
      });
    } catch (err: any) {
      return c.json({ error: err.message }, 401);
    }
  }
}

export class LogoutController implements BaseController {
  constructor(private authUseCase: AuthUseCase) {}

  async main(c: Context): Promise<Response> {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      this.authUseCase.logout(token);
    }
    return c.json({ success: true });
  }
}

export class UpdateConfigController implements BaseController {
  constructor(private authUseCase: AuthUseCase) {}

  async main(c: Context): Promise<Response> {
    const userId = c.get('userId');
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    try {
      const { provider, geminiApiKey, openaiApiKey, openaiBaseUrl, openaiModel } = await c.req.json();
      this.authUseCase.updateConfig(userId, provider, geminiApiKey, openaiApiKey, openaiBaseUrl, openaiModel);
      return c.json({ success: true });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  }
}
