import express from "express";
import { consumeConfirmation } from "../confirmations.js";
import { logConfirmation } from "../audit.js";

export const confirmRouter = express.Router();

confirmRouter.post("/:id", async (req, res) => {
  const session = req.cookies.session;
  if (!session) return res.status(401).end();

  const confirmation = consumeConfirmation(req.params.id);
  if (!confirmation) {
    return res.status(404).json({ error: "Invalid or expired confirmation" });
  }

  await logConfirmation({
    actorId: session.id,
    guildId: confirmation.guildId,
    action: confirmation.action,
    details: confirmation.details,
  });

  res.json({ confirmed: true });
});
