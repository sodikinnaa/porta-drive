import { Hono } from "hono";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import { createDependencies } from "./container";
import { createRoutings } from "./router/routing.config";
import { setUpRoutes } from "./router/router";
import { createAuthMiddleware } from "./middleware/auth.middleware";

export function createApp() {
  const { sessionManager, controllers } = createDependencies();
  const routings = createRoutings(controllers);

  const app = new Hono();
  
  // Middleware
  app.use("*", logger());
  app.use("/api/*", createAuthMiddleware(sessionManager));

  // Set up API routes
  setUpRoutes(app, routings);

  // Dynamic installer script
  app.get("/install.sh", async (c) => {
    const url = new URL(c.req.url);
    const origin = url.origin;
    try {
      let content = await Bun.file("./install.sh").text();
      // Replace the Github release download URL with the dynamic VPS origin URL
      content = content.replace(
        'DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/porta-drive-${PLATFORM}"',
        `DOWNLOAD_URL="${origin}/porta-drive-\${PLATFORM}"`
      );
      return c.text(content, 200, {
        "Content-Type": "application/x-sh",
      });
    } catch (e) {
      return c.text("echo 'Error: install.sh not found on server'", 500, {
        "Content-Type": "application/x-sh",
      });
    }
  });

  // Favicon serving
  app.get("/favicon.ico", serveStatic({ path: "./public/logo.png" }));

  // Static files serving
  app.get("/", serveStatic({ path: "./public/index.html" }));
  app.get("/app", serveStatic({ path: "./public/app.html" }));
  app.get("/login", serveStatic({ path: "./public/login.html" }));
  app.get("/register", serveStatic({ path: "./public/register.html" }));
  app.use("/*", serveStatic({ root: "./public" }));

  return app;
}
