import type { FastifyInstance } from "fastify";
import {
  getMeHandler,
  getBySlugHandler,
  updateRulesHandler,
  rotateQrHandler,
  updatePinHandler,
  listMerchantsHandler,
  updateProfileHandler,
} from "../controllers/merchant.controller.js";
import { authenticate, requireRole } from "../middlewares/auth.middleware.js";

export async function merchantRoutes(app: FastifyInstance) {
  // 1. Public route to list all merchants: GET /api/v1/merchants
  app.get("/", listMerchantsHandler);

  // 2. Public route for standee scan pass page: /s/:slug
  app.get("/slug/:slug", getBySlugHandler);

  // 3. Authenticated shop owner profile routes: GET /profile, PUT /profile, PATCH /profile, GET /me
  app.get("/me", { preHandler: [authenticate, requireRole(["MERCHANT", "ADMIN"])] }, getMeHandler);
  app.get("/profile", { preHandler: [authenticate, requireRole(["MERCHANT", "ADMIN"])] }, getMeHandler);
  app.put("/profile", { preHandler: [authenticate, requireRole(["MERCHANT", "ADMIN"])] }, updateProfileHandler);
  app.patch("/profile", { preHandler: [authenticate, requireRole(["MERCHANT", "ADMIN"])] }, updateProfileHandler);

  // 4. Shop rules, QR rotation, and Cashier PIN management
  app.patch("/rules", { preHandler: [authenticate, requireRole(["MERCHANT", "ADMIN"])] }, updateRulesHandler);
  app.post("/rotate-qr", { preHandler: [authenticate, requireRole(["MERCHANT", "ADMIN"])] }, rotateQrHandler);
  app.patch("/terminal-pin", { preHandler: [authenticate, requireRole(["MERCHANT", "ADMIN"])] }, updatePinHandler);
}
