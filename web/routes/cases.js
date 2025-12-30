import express from "express";
import {
  loadCases,
  deleteCase,
  hasWebPermission,
} from "../../moderation/core.js";
import { requireAuth, requireGuildAccess } from "../middleware/auth.js";
import { logAudit } from "../audit.js";

export const casesRouter = express.Router();

casesRouter.get("/:guildId", requireAuth, requireGuildAccess, async (req, res) => {
  res.json(await loadCases(req.params.guildId));
});

casesRouter.get("/:guildId/search", requireAuth, requireGuildAccess, async (req, res) => {
  const { q, type, userId } = req.query;
  const data = await loadCases(req.params.guildId);

  let cases = data.cases;

  if (q) cases = cases.filter(c => c.reason?.toLowerCase().includes(q.toLowerCase()));
  if (type) cases = cases.filter(c => c.type === type);
  if (userId) cases = cases.filter(c => c.userId === userId);

  res.json(cases);
});

import { createConfirmation } from "../confirmations.js";

casesRouter.delete("/:guildId/:caseNumber", requireAuth, requireGuildAccess, async (req, res) => {
  const { guildId, caseNumber } = req.params;
  const actorId = req.cookies.session.id;

  if (!hasWebPermission(guildId, actorId, "case")) {
    return res.status(403).json({ error: "Missing permission: case" });
  }

  const confirmId = createConfirmation({
    guildId,
    action: "DELETE_CASE",
    details: { caseNumber },
  });

  res.json({
    requiresConfirmation: true,
    confirmationId: confirmId,
  });
});


  res.json({ success: true });
});
