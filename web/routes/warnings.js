import express from "express";
import {
  loadWarnings,
  revertWarning,
  hasWebPermission,
} from "../../moderation/core.js";
import { requireAuth, requireGuildAccess } from "../middleware/auth.js";
import { logAudit } from "../audit.js";

export const warningsRouter = express.Router();

warningsRouter.get("/:guildId", requireAuth, requireGuildAccess, async (req, res) => {
  res.json(await loadWarnings(req.params.guildId));
});

import { createConfirmation } from "../confirmations.js";

warningsRouter.post("/:guildId/revert/:userId", requireAuth, requireGuildAccess, async (req, res) => {
  const { guildId, userId: targetUserId } = req.params;
  const actorId = req.cookies.session.id;

  if (!hasWebPermission(guildId, actorId, "warn")) {
    return res.status(403).json({ error: "Missing permission: warn" });
  }

  const confirmId = createConfirmation({
    guildId,
    action: "REVERT_WARNING",
    details: { targetUserId },
  });

  res.json({
    requiresConfirmation: true,
    confirmationId: confirmId,
  });
});
