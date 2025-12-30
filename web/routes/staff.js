import express from "express";
import { getStaffConfig } from "../../moderation/staffConfig.js";
import { requireAuth, requireGuildAccess } from "../middleware/auth.js";

export const staffRouter = express.Router();

staffRouter.get("/:guildId", requireAuth, requireGuildAccess, async (req, res) => {
  const { guildId } = req.params;
  const config = getStaffConfig(guildId);

  res.json(config);
});
