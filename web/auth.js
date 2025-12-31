import express from "express";
import fetch from "node-fetch";

export const authRouter = express.Router();

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = "https://cases.spy-gaming.com/auth/callback";

authRouter.get("/login", (req, res) => {
  const url =
    "https://discord.com/oauth2/authorize" +
    `?client_id=${CLIENT_ID}` +
    "&response_type=code" +
    "&scope=identify%20guilds" +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  res.redirect(url);
});

authRouter.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:
        `client_id=${CLIENT_ID}` +
        `&client_secret=${CLIENT_SECRET}` +
        `&grant_type=authorization_code` +
        `&code=${code}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`,
    });

    const token = await tokenRes.json();

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });

    const user = await userRes.json();

    const guildRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });

    const guilds = await guildRes.json();

    res.cookie(
      "session",
      {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        guilds,
      },
      {
        httpOnly: true,
        secure: true,
        sameSite: "none",
      }
    );

    // ✅ redirect back to dashboard after login
    res.redirect("/");
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.status(500).send("Authentication failed");
  }
});

