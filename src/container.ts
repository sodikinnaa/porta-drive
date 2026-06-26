import { Database } from "bun:sqlite";

// Gateways
import { SqliteUserRepository, SqliteConversationRepository, SqliteMessageRepository } from "./adapters/gateways/db.repository.impl";
import { DriveClientImpl } from "./adapters/gateways/drive.client.impl";
import { AIClientImpl } from "./adapters/gateways/ai.client.impl";

// Usecases
import { AuthUseCase, SessionManager } from "./application/usecases/auth.usecase";
import { ConversationUseCase } from "./application/usecases/conversation.usecase";
import { DriveUseCase } from "./application/usecases/drive.usecase";
import { ChatUseCase } from "./application/usecases/chat.usecase";

// Controllers
import { RegisterController, LoginController, LogoutController, UpdateConfigController } from "./adapters/ui/routes/auth/controllers";
import { ListConversationsController, CreateConversationController, DeleteConversationController, GetMessagesController } from "./adapters/ui/routes/conversations/controllers";
import { ScanDriveController } from "./adapters/ui/routes/drive/scan.controller";
import { ChatController, ModelsController, TestConfigController } from "./adapters/ui/routes/chat/controllers";

import type { BaseController } from "./adapters/ui/routes/base.controller";

export interface AppDependencies {
  sessionManager: SessionManager;
  controllers: {
    register: BaseController;
    login: BaseController;
    logout: BaseController;
    updateConfig: BaseController;
    listConversations: BaseController;
    createConversation: BaseController;
    deleteConversation: BaseController;
    getMessages: BaseController;
    scanDrive: BaseController;
    chat: BaseController;
    models: BaseController;
    testConfig: BaseController;
  };
}

export function createDependencies(): AppDependencies {
  // Initialize Database
  const db = new Database("portadrive.db");
  db.run("PRAGMA foreign_keys = ON;");

  // Create Tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      gemini_api_key TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      folder_id TEXT,
      folder_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT,
      tool_calls TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `);

  // Migrations
  try {
    db.run("ALTER TABLE users ADD COLUMN provider TEXT DEFAULT 'gemini';");
  } catch (e) {}
  try {
    db.run("ALTER TABLE users ADD COLUMN openai_api_key TEXT;");
  } catch (e) {}
  try {
    db.run("ALTER TABLE users ADD COLUMN openai_base_url TEXT;");
  } catch (e) {}
  try {
    db.run("ALTER TABLE users ADD COLUMN openai_model TEXT;");
  } catch (e) {}

  // Initialize Repositories
  const userRepository = new SqliteUserRepository(db);
  const conversationRepository = new SqliteConversationRepository(db);
  const messageRepository = new SqliteMessageRepository(db);
  const driveRepository = new DriveClientImpl();
  const aiRepository = new AIClientImpl();

  // Initialize Usecases
  const sessionManager = new SessionManager();
  const authUseCase = new AuthUseCase(userRepository, sessionManager);
  const conversationUseCase = new ConversationUseCase(conversationRepository, messageRepository);
  const driveUseCase = new DriveUseCase(driveRepository);
  const chatUseCase = new ChatUseCase(userRepository, messageRepository, driveRepository, aiRepository);

  // Initialize Controllers
  const registerController = new RegisterController(authUseCase);
  const loginController = new LoginController(authUseCase);
  const logoutController = new LogoutController(authUseCase);
  const updateConfigController = new UpdateConfigController(authUseCase);

  const listConversationsController = new ListConversationsController(conversationUseCase);
  const createConversationController = new CreateConversationController(conversationUseCase);
  const deleteConversationController = new DeleteConversationController(conversationUseCase);
  const getMessagesController = new GetMessagesController(conversationUseCase);

  const scanDriveController = new ScanDriveController(driveUseCase);

  const chatController = new ChatController(chatUseCase);
  const modelsController = new ModelsController(chatUseCase);
  const testConfigController = new TestConfigController(chatUseCase);

  return {
    sessionManager,
    controllers: {
      register: registerController,
      login: loginController,
      logout: logoutController,
      updateConfig: updateConfigController,
      listConversations: listConversationsController,
      createConversation: createConversationController,
      deleteConversation: deleteConversationController,
      getMessages: getMessagesController,
      scanDrive: scanDriveController,
      chat: chatController,
      models: modelsController,
      testConfig: testConfigController
    }
  };
}
