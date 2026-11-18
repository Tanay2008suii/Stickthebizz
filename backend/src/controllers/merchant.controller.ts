import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../config/db.js";
import {
  getMerchantProfile,
  getMerchantBySlug,
  updateMerchantRules,
  rotateMerchantQrCode,
  updateTerminalPin,
} from "../services/merchant.service.js";

export async function getMeHandler(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user) {
    return reply.status(401).send({ success: false, error: "UNAUTHORIZED" });
  }

  const merchant = await getMerchantProfile(req.user.userId);
  if (!merchant) {
    return reply.status(200).send({ success: true, merchant: null, needsSetup: true });
  }

  return reply.status(200).send({ success: true, merchant, needsSetup: false });
}

export async function getBySlugHandler(req: FastifyRequest, reply: FastifyReply) {
  const params = (req.params as any) || {};
  const slug = params.slug;

  if (!slug) {
    return reply.status(400).send({ success: false, error: "Slug is required" });
  }

  const merchant = await getMerchantBySlug(slug);
  if (!merchant) {
    return reply.status(404).send({ success: false, error: "Merchant not found" });
  }

  return reply.status(200).send({ success: true, merchant });
}

export async function updateRulesHandler(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user) {
    return reply.status(401).send({ success: false, error: "UNAUTHORIZED" });
  }

  const body = (req.body as any) || {};
  if (!body.merchantId) {
    return reply.status(400).send({ success: false, error: "merchantId is required" });
  }

  try {
    const updated = await updateMerchantRules({
      merchantId: body.merchantId,
      ownerUserId: req.user.userId,
      name: body.name,
      category: body.category,
      minSpend: body.minSpend !== undefined ? Number(body.minSpend) : undefined,
      visitsRequired: body.visitsRequired !== undefined ? Number(body.visitsRequired) : undefined,
      rewardName: body.rewardName,
      validityDays: body.validityDays !== undefined ? Number(body.validityDays) : undefined,
      redemptionPin: body.redemptionPin,
    });

    return reply.status(200).send({ success: true, merchant: updated });
  } catch (err: any) {
    return reply.status(400).send({ success: false, error: err.message });
  }
}

export async function rotateQrHandler(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user) {
    return reply.status(401).send({ success: false, error: "UNAUTHORIZED" });
  }

  const body = (req.body as any) || {};
  if (!body.merchantId) {
    return reply.status(400).send({ success: false, error: "merchantId is required" });
  }

  try {
    const updated = await rotateMerchantQrCode(body.merchantId, req.user.userId);
    return reply.status(200).send({ success: true, merchant: updated });
  } catch (err: any) {
    return reply.status(400).send({ success: false, error: err.message });
  }
}

export async function updatePinHandler(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user) {
    return reply.status(401).send({ success: false, error: "UNAUTHORIZED" });
  }

  const body = (req.body as any) || {};
  if (!body.merchantId || !body.pin) {
    return reply.status(400).send({ success: false, error: "Both merchantId and 4-digit pin are required" });
  }

  try {
    const updated = await updateTerminalPin(body.merchantId, req.user.userId, body.pin);
    return reply.status(200).send({ success: true, merchant: updated });
  } catch (err: any) {
    return reply.status(400).send({ success: false, error: err.message });
  }
}

export async function listMerchantsHandler(req: FastifyRequest, reply: FastifyReply) {
  try {
    const merchants = await prisma.merchant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        minSpend: true,
        visitsRequired: true,
        rewardName: true,
        subscriptionStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return reply.status(200).send({ success: true, merchants });
  } catch (err: any) {
    return reply.status(500).send({ success: false, error: err.message });
  }
}

export async function updateProfileHandler(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user) {
    return reply.status(401).send({ success: false, error: "UNAUTHORIZED" });
  }

  const merchant = await prisma.merchant.findFirst({
    where: { ownerId: req.user.userId },
  });

  if (!merchant) {
    return reply.status(404).send({ success: false, error: "Merchant not found for current user" });
  }

  const body = (req.body as any) || {};

  try {
    const updated = await updateMerchantRules({
      merchantId: merchant.id,
      ownerUserId: req.user.userId,
      name: body.name,
      category: body.category,
      minSpend: body.minSpend !== undefined ? Number(body.minSpend) : undefined,
      visitsRequired: body.visitsRequired !== undefined ? Number(body.visitsRequired) : undefined,
      rewardName: body.rewardName,
      validityDays: body.validityDays !== undefined ? Number(body.validityDays) : undefined,
      redemptionPin: body.redemptionPin,
    });

    return reply.status(200).send({ success: true, merchant: updated });
  } catch (err: any) {
    return reply.status(400).send({ success: false, error: err.message });
  }
}

