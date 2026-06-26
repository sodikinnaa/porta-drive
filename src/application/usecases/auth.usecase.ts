import type { UserRepository } from "../repositories/user.repository";
import type { User } from "../../domain/entities";

export class SessionManager {
  private sessions = new Map<string, number>();

  createSession(token: string, userId: number): void {
    this.sessions.set(token, userId);
  }

  getUserId(token: string): number | null {
    return this.sessions.get(token) || null;
  }

  deleteSession(token: string): void {
    this.sessions.delete(token);
  }
}

export class AuthUseCase {
  constructor(
    private userRepository: UserRepository,
    private sessionManager: SessionManager
  ) {}

  async register(username: string, passwordHash: string): Promise<void> {
    const existing = this.userRepository.getUserByUsername(username);
    if (existing) {
      throw new Error("Username already exists");
    }
    this.userRepository.createUser(username, passwordHash);
  }

  async login(username: string, passwordPlain: string): Promise<{ token: string; user: User }> {
    const user = this.userRepository.getUserByUsername(username);
    if (!user) {
      throw new Error("Invalid username or password");
    }

    const valid = await Bun.password.verify(passwordPlain, user.password_hash);
    if (!valid) {
      throw new Error("Invalid username or password");
    }

    const token = crypto.randomUUID();
    this.sessionManager.createSession(token, user.id);

    return { token, user };
  }

  logout(token: string): void {
    this.sessionManager.deleteSession(token);
  }

  updateConfig(
    userId: number,
    provider: string,
    geminiApiKey: string,
    openaiApiKey: string,
    openaiBaseUrl: string,
    openaiModel: string
  ): void {
    if (provider === 'gemini') {
      this.userRepository.updateUserApiKey(userId, geminiApiKey);
      this.userRepository.updateUserProvider(userId, 'gemini');
    } else if (provider === 'openai_compatible') {
      this.userRepository.updateUserOpenAIConfig(userId, 'openai_compatible', openaiApiKey, openaiBaseUrl, openaiModel);
    } else {
      throw new Error("Invalid provider");
    }
  }

  getUserById(userId: number): User | null {
    return this.userRepository.getUserById(userId);
  }
}
