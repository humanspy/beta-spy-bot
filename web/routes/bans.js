import express from "express";
import { hasWebPermission } from "../../moderation/core.js";
import { requireAuth, requireGuildAccess } from "../middleware/auth.js";
import { createConfirmation } from "../confirmations.js";

export const bansRouter = express.Router();

/* ===================== HACKBAN ===================== */
/* Permission: hackban */

bansRouter.post("/:guildId/hackban", requireAuth, requireGuildAccess, async (req, res) => {
  const { guildId } = req.params;
  const { userId, reason } = req.body;
  const actorId = req.cookies.session.id;

  if (!hasWebPermission(guildId, actorId, "hackban")) {
    return res.status(403).json({ error: "Missing permission: hackban" });
  }

  const confirmationId = createConfirmation({
    guildId,
    action: "HACKBAN",
    details: {
      targetUserId: userId,
      reason,
    },
  });

  res.json({
    requiresConfirmation: true,
    confirmationId,
  });
});

/* ===================== UNBAN ===================== */
/* Permission: unban */

bansRouter.post("/:guildId/unban", requireAuth, requireGuildAccess, async (req, res) => {
  const { g
