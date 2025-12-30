import express from "express";
import { getStaffConfig } from "../../moderation/staffConfig.js";
import { requireAuth, requireGuildAccess } from "../middleware/auth.js";

export const roleRouter = express.Router();

roleRouter.get("/:guildId", requireAuth, requireGuildAccess, (req, res) => {
  const { guildId } = req.params;
  const userId = req.cookies.session.id;

  const config = getStaffConfig(guildId);
  if (!config?.staffRoles) {
    return res.json({ role: "Member", level: null });
  }

  let bestRole = null;

  for (const role of config.staffRoles) {
    if (role.users?.includes(userId)) {
      if (!bestRole || role.level < bestRole.level) {
        bestRole = role;
      }
    }
  }

  if (!bestRole) {
    return res.json({ role: "Member", level: null });
  }

  res.json({
    role: bestRole.name,
    level: bestRole.level,
  });
});
