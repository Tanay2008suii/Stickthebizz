import { FastifyInstance } from "fastify";
import { AuthController } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";

export async function authRoutes(fastify: FastifyInstance) {
  // 1. Customer OTP Endpoints (Supports both paths)
  fastify.post("/customer/otp/request", AuthController.requestOtp);
  fastify.post("/customer/otp/verify", AuthController.verifyOtp);
  fastify.post("/otp/send", AuthController.requestOtp);
  fastify.post("/otp/verify", AuthController.verifyOtp);

  // 2. Customer Direct / Session Login
  fastify.post("/customer/login", AuthController.customerLogin);

  // 3. Shop Owner Authentication Endpoints
  fastify.post("/owner/register", AuthController.registerMerchant);
  fastify.post("/owner/login", AuthController.loginMerchant);

  // 4. Session Refresh and Logout
  fastify.post("/refresh", AuthController.refresh);
  fastify.post("/logout", AuthController.logout);

  // 5. User Profile
  fastify.get("/me", { preHandler: [authenticate] }, AuthController.getMe);
}
