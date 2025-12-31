import express from "express";
import fs from "fs/promises";
import { requireAuth, requireGuildAccess } from "../middleware/auth.js";

export const appealsRouter = express.Router();

const APPEALS_PATH = "./modmail/storage/appeals.json";

async function loadAppeals() {
  try {
    const raw = await fs.readFile(APPEALS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveAppeals(data) {
  await fs.mkdir("./modmail/storage", { recursive: true });
  await fs.writeFile(APPEALS_PATH, JSON.stringify(data, null, 2));
}

/**
 * Get appeal usage
 * Route used by the dashboard
 * GET /api/appeals/:guildId/:userId?
 */
appealsRouter.get(
  "/:guildId/:userId?",
  requireAuth,
  requireGuildAccess,
  async (req, res) => {
    const { guildId } = req.params;
    const userId = req.params.userId ?? req.cookies.session.id;

    const appeals = await loadAppeals();
    const used = appeals[guildId]?.[userId] ?? 0;

    res.json({ used });
  }
);

/**
 * Increment appeal usage
 * Internal use (modmail / appeal submission)
 * POST /api/appeals/:guildId/:userId
 */
appealsRouter.post(
  "/:guildId/:userId",
  requireAuth,
  requireGuildAccess,
  async (req, res) => {
    const { guildId, userId } = req.params;

    const appeals = await loadAppeals();

    if (!appeals[guildId]) appeals[guildId] = {};
    appeals[guildId][userId] = (appeals[guildId][userId] ?? 0) + 1;

    await saveAppeals(appeals);

    res.json({
      success: true,
      used: appeals[guildId][userId],
    });
  }
);
