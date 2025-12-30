import express from "express";
import { requireAuth } from "../middleware/auth.js";

export const guildsRouter = express.Router();

guildsRouter.get("/", requireAuth, async (req, res) => {
  const session = req.cookies.session;

  const manageable = session.guilds.filter(
    g => (g.permissions & 0x8) !== 0
  );

  res.json(manageable.map(g => ({
    id: g.id,
    name: g.name,
    icon: g.icon,
  })));
});
