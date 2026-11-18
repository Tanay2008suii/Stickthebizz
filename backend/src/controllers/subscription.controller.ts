import type { FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { cleanIndianPhone, sanitizeString } from "../utils/sanitize.js";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";
import { SUBSCRIPTION_PLANS } from "../utils/pricing.js";
import {
  validatePromoCodeService,
  createSubscriptionOrderService,
  activateSubscriptionService,
  checkMerchantSubscriptionStatus,
} from "../services/subscription.service.js";

export async function getPlansHandler(req: FastifyRequest, reply: FastifyReply) {
  const plans = Object.values(SUBSCRIPTION_PLANS);
  return reply.status(200).send({
    success: true,
    plans,
  });
}

export async function validatePromoHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = (req.body as any) || {};
  const code = body.code || body.promoCode;
  const planId = body.planId || "MONTHLY";

  if (!code) {
    return reply.status(400).send({ success: false, message: "Please provide a promo code" });
  }

  const result = await validatePromoCodeService({ code, planId });
  return reply.status(result.success ? 200 : 400).send(result);
}

export async function createOrderHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = (req.body as any) || {};

  if (!body.shopName || !body.email || !body.mobile) {
    return reply.status(400).send({
      success: false,
      message: "shopName, email, and mobile are required.",
    });
  }

  const result = await createSubscriptionOrderService({
    planId: body.planId || "MONTHLY",
    promoCode: body.promoCode,
    shopName: body.shopName,
    email: body.email,
    mobile: body.mobile,
  });

  return reply.status(result.success ? 200 : 400).send(result);
}

export async function activateHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = (req.body as any) || {};

  let ownerUserId = req.user?.userId;
  let resolvedUser: any = null;

  if (ownerUserId) {
    resolvedUser = await prisma.user.findUnique({ where: { id: ownerUserId } });
  } else {
    // If user is not yet logged in on this browser, resolve or provision account via verified payment proof
    const cleanEmail = (body.email || "").trim().toLowerCase();
    const cleanPhoneDigits = cleanIndianPhone(body.mobile || "");

    if (!cleanEmail) {
      return reply.status(400).send({
        success: false,
        message: "Email is required for subscription activation.",
      });
    }

    resolvedUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanEmail },
          ...(cleanPhoneDigits.length === 10 ? [{ phone: cleanPhoneDigits }] : []),
        ],
      },
    });

    if (!resolvedUser) {
      const rawPassword = body.password || "StoreOwner@123";
      const passwordHash = await bcrypt.hash(rawPassword, 10);
      resolvedUser = await prisma.user.create({
        data: {
          email: cleanEmail,
          phone: cleanPhoneDigits || null,
          fullName: sanitizeString(body.ownerName) || "Store Owner",
          passwordHash,
          role: "MERCHANT",
          isVerified: true,
        },
      });
    }

    ownerUserId = resolvedUser.id;
  }

  try {
    const result = await activateSubscriptionService({
      orderId: body.orderId,
      paymentId: body.paymentId,
      signature: body.signature,
      planId: body.planId || "MONTHLY",
      promoCode: body.promoCode,
      shopName: body.shopName,
      ownerName: body.ownerName,
      category: body.category,
      mobile: body.mobile,
      email: body.email,
      ownerUserId: ownerUserId ?? '',
    });

    // Generate fresh session tokens so merchant terminal is immediately authenticated
    const tokenPayload = {
      userId: resolvedUser.id,
      email: resolvedUser.email,
      role: "MERCHANT" as const,
    };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);
    const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        userId: resolvedUser.id,
        refreshToken,
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip,
        expiresAt: thirtyDaysAhead,
      },
    });

    const isProd = env.NODE_ENV === "production";
    reply.setCookie("access_token", accessToken, {
      path: "/",
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 15 * 60,
    });

    reply.setCookie("refresh_token", refreshToken, {
      path: "/api/v1/auth",
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 30 * 24 * 60 * 60,
    });

    return reply.status(200).send({
      ...result,
      accessToken,
      user: {
        id: resolvedUser.id,
        email: resolvedUser.email,
        phone: resolvedUser.phone,
        fullName: resolvedUser.fullName,
        role: "MERCHANT",
      },
    });
  } catch (err: any) {
    return reply.status(400).send({ success: false, message: err.message });
  }
}

export async function checkStatusHandler(req: FastifyRequest, reply: FastifyReply) {
  const params = (req.params as any) || {};
  const query = (req.query as any) || {};
  const merchantId = params.merchantId || query.merchantId;

  if (!merchantId) {
    return reply.status(400).send({ success: false, error: "merchantId is required" });
  }

  const result = await checkMerchantSubscriptionStatus(merchantId);
  return reply.status(200).send(result);
}

