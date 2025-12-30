import express from "express";

export const logoutRouter = express.Router();

logoutRouter.post("/", (req, res) => {
  res.clearCookie("session", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });

  res.json({ success: true });
});
