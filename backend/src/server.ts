import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rawBody from "fastify-raw-body";
import { env } from "./config/env.js";
import { prisma } from "./config/db.js";
import { registerWebSocket } from "./websocket/server.js";
import { registerApiRoutes } from "./routes/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { startDailyResetCron } from "./cron/daily-reset.cron.js";

export async function buildServer() {
  const server = Fastify({
    logger: env.NODE_ENV === "development" ? true : false,
    disableRequestLogging: env.NODE_ENV === "production",
  });

  // 1. Error Handler
  server.setErrorHandler(errorHandler);

  // 2. Raw Body Plugin (Crucial for Razorpay webhook HMAC verification)
  await server.register(rawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
    routes: ["/api/v1/webhooks/razorpay"],
  });

  // 3. Cookie Support
  await server.register(cookie, {
    secret: env.JWT_ACCESS_SECRET,
  });

  // 4. Cross-Origin Resource Sharing (CORS) with Credentials
  const rawAllowedOrigins = env.FRONTEND_URL.split(",").map((u) => u.trim()).filter(Boolean);
  const allowedOrigins = new Set<string>(rawAllowedOrigins);

  // Automatically derive apex and www variants for configured frontend origins
  for (const originUrl of rawAllowedOrigins) {
    try {
      const parsed = new URL(originUrl);
      if (parsed.hostname.startsWith("www.")) {
        const apexHost = parsed.hostname.slice(4);
        allowedOrigins.add(`${parsed.protocol}//${apexHost}${parsed.port ? `:${parsed.port}` : ""}`);
      } else if (!parsed.hostname.includes("localhost") && !parsed.hostname.includes("127.0.0.1")) {
        const wwwHost = `www.${parsed.hostname}`;
        allowedOrigins.add(`${parsed.protocol}//${wwwHost}${parsed.port ? `:${parsed.port}` : ""}`);
      }
    } catch {
      // Ignore invalid URL entries
    }
  }

  // Ensure production domains are always explicitly permitted
  allowedOrigins.add("https://stickthebizz.in");
  allowedOrigins.add("https://www.stickthebizz.in");
  allowedOrigins.add("https://stickthebizz.vercel.app");

  await server.register(cors, {
    credentials: true,
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return cb(null, true);
      const isAllowed =
        allowedOrigins.has(origin) ||
        env.NODE_ENV === "development" ||
        /^https:\/\/([a-z0-9-]+\.)?stickthebizz\.in$/i.test(origin) ||
        /^https:\/\/stickthebizz[a-z0-9-]*\.vercel\.app$/i.test(origin);

      if (isAllowed) {
        return cb(null, true);
      }
      return cb(new Error(`Origin '${origin}' not allowed by CORS`), false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
  });

  // 5. WebSocket Support
  await registerWebSocket(server);

  // 6. Mount all REST API Routes
  await registerApiRoutes(server);

  // 7. Root Welcome Route
  server.get("/", async () => {
    return {
      service: "StickTheBizz Backend API",
      status: "online",
      version: "2.0.0",
      architecture: "Decoupled Fastify + Prisma + Supabase PG",
      healthCheck: "/api/v1/health",
      timestamp: new Date().toISOString(),
    };
  });

  return server;
}

async function start() {
  try {
    const server = await buildServer();
    const port = env.PORT;
    const host = "0.0.0.0"; // Bind to all interfaces for Render/Docker/Cloud

    await server.listen({ port, host });
    console.log(`\n🚀 StickTheBizz Backend Server running on http://${host}:${port}`);
    console.log(`💚 Health check route: http://${host}:${port}/api/v1/health`);
    console.log(`📡 WebSocket endpoint: ws://${host}:${port}/ws`);

    // Start 12:00 AM IST Daily Reset Cron
    startDailyResetCron();

    // Graceful Shutdown
    const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`\n🛑 Received ${signal}, closing server gracefully...`);
        await server.close();
        await prisma.$disconnect();
        process.exit(0);
      });
    });
  } catch (err) {
    console.error("Failed to start backend server:", err);
    process.exit(1);
  }
}

// Start if run directly
if (require.main === module) {
  start();
}
