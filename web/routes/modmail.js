import express from "express";
import fs from "fs/promises";
import { requireAuth, requireGuildAccess } from "../middleware/auth.js";

const APPEALS_PATH = "./modmail/storage/appeals.json";

export const modmailRouter = express.Router();

async function loadAppeals() {
  try {
    return JSON.parse(await fs.readFile(APPEALS_PATH, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Get appeal usage for a user
 * - userId defaults to the logged-in user
 */
modmailRouter.get(
  "/appeals/:guildId/:userId?",
  requireAuth,
  requireGuildAccess,
  async (req, res) => {
    const { guildId } = req.params;
    const targetUserId = req.params.userId ?? req.cookies.session.id;

    const appeals = await loadAppeals();
    const used = appeals[guildId]?.[targetUserId] ?? 0;

    res.json({
      used,
    });
  }
);
