import express from "express";
import { requireAuth } from "../middleware/auth.js";

export const meRouter = express.Router();

meRouter.get("/", requireAuth, (req, res) => {
  const session = req.cookies.session;

  res.json({
    id: session.id,
    username: session.username,
    avatar: session.avatar || null,
  });
});
