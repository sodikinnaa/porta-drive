import type { User } from "../../domain/entities";

export interface UserRepository {
  createUser(username: string, passwordHash: string): void;
  getUserByUsername(username: string): User | null;
  getUserById(id: number): User | null;
  updateUserApiKey(userId: number, apiKey: string): void;
  updateUserOpenAIConfig(userId: number, provider: string, apiKey: string, baseUrl: string, model: string): void;
  updateUserProvider(userId: number, provider: string): void;
}
