import type { FastifyInstance } from "fastify";
import {
  validatePromoHandler,
  createOrderHandler,
  activateHandler,
  checkStatusHandler,
  getPlansHandler,
} from "../controllers/subscription.controller.js";
import { razorpayWebhookHandler } from "../controllers/webhook.controller.js";
import { optionalAuthenticate } from "../middlewares/auth.middleware.js";

export async function subscriptionRoutes(app: FastifyInstance) {
  // 1. Subscription Plans
  app.get("/plans", getPlansHandler);

  // 2. Promo code validation (public / pre-auth)
  app.post("/validate-promo", validatePromoHandler);

  // 3. Razorpay order creation (public / pre-auth)
  app.post("/razorpay/order", createOrderHandler);
  app.post("/order", createOrderHandler);
  app.post("/create-order", createOrderHandler);

  // 4. Create / Activate subscription (authenticated merchant or verified Razorpay payment proof)
  app.post("/create", { preHandler: [optionalAuthenticate] }, activateHandler);
  app.post("/activate", { preHandler: [optionalAuthenticate] }, activateHandler);

  // 5. Razorpay Webhook listener under subscriptions
  app.post("/webhooks/razorpay", razorpayWebhookHandler);

  // 6. Live subscription status & grace period check
  app.get("/status/:merchantId", checkStatusHandler);
  app.get("/status", checkStatusHandler);
}
