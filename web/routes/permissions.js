import express from "express";
import { hasWebPermission } from "../../moderation/core.js";
import { requireAuth, requireGuildAccess } from "../middleware/auth.js";

export const permissionsRouter = express.Router();

permissionsRouter.get("/:guildId", requireAuth, requireGuildAccess, (req, res) => {
  const { guildId } = req.params;
  const userId = req.cookies.session.id;

  const permissions = {
    case: hasWebPermission(guildId, userId, "case"),
    warn: hasWebPermission(guildId, userId, "warn"),
    hackban: hasWebPermission(guildId, userId, "hackban"),
    unban: hasWebPermission(guildId, userId, "unban"),
  };

  res.json(permissions);
});
