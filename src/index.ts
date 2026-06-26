import { createApp } from "./app";

const app = createApp();
const START_PORT = 3000;
let port = START_PORT;
let server;

while (true) {
  try {
    server = Bun.serve({
      port: port,
      fetch: app.fetch
    });
    break;
  } catch (e: any) {
    // Bun EADDRINUSE can throw error with message code or generic message
    if (e.code === 'EADDRINUSE' || e.message?.includes('address already in use') || e.message?.includes('EADDRINUSE')) {
      console.log(`Port ${port} in use, trying next port...`);
      port++;
    } else {
      throw e;
    }
  }
}

console.log(`===============================================`);
console.log(`🍀  PortaDrive Chatbot Server (Hono) is running!`);
console.log(`🔗  Local URL: http://localhost:${port}`);
console.log(`===============================================`);
export default server;
