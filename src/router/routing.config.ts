import type { Route } from "./route";
import type { BaseController } from "../adapters/ui/routes/base.controller";

export function createRoutings(controllers: {
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
}): Route[] {
  return [
    { name: 'register', controller: controllers.register, path: '/api/auth/register', methods: ['post'] },
    { name: 'login', controller: controllers.login, path: '/api/auth/login', methods: ['post'] },
    { name: 'logout', controller: controllers.logout, path: '/api/auth/logout', methods: ['post'] },
    { name: 'updateConfig', controller: controllers.updateConfig, path: '/api/auth/update-key', methods: ['post'] },
    { name: 'listConversations', controller: controllers.listConversations, path: '/api/conversations', methods: ['get'] },
    { name: 'createConversation', controller: controllers.createConversation, path: '/api/conversations', methods: ['post'] },
    { name: 'deleteConversation', controller: controllers.deleteConversation, path: '/api/conversations/delete', methods: ['post'] },
    { name: 'getMessages', controller: controllers.getMessages, path: '/api/conversations/messages', methods: ['post'] },
    { name: 'scanDrive', controller: controllers.scanDrive, path: '/api/scan', methods: ['post'] },
    { name: 'chat', controller: controllers.chat, path: '/api/chat', methods: ['post'] },
    { name: 'models', controller: controllers.models, path: '/api/models', methods: ['get'] },
    { name: 'testConfig', controller: controllers.testConfig, path: '/api/models/test', methods: ['post'] }
  ];
}
