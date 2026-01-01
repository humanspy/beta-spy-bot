// index.js (Main)
import "dotenv/config";
import fs from "fs/promises";
import bcrypt from "bcrypt";
import { execSync } from "child_process";
import { existsSync } from "fs";
import "./web/server.js";

console.log(execSync("which ffmpeg").toString());
console.log(execSync("ffmpeg -version").toString());


import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
} from "discord.js";

import { setupPlayer } from "./music/player.js";
import { organizeCasesToFolder } from "./moderation/organize-cases.js";
import { ensureDataPath } from "./utils/storage.js";
import { getStaffConfig } from "./moderation/staffConfig.js";

await ensureDataPath();


import { handleCounting } from "./counting/index.js";
import { handleLeveling } from "./profile/level/index.js";


/* ===================== DEPLOY COMMANDS ===================== */

if (existsSync("./deploy-commands.js")) {
  try {
    console.log("📦 Deploying slash commands...");
    execSync("node ./deploy-commands.js", { stdio: "inherit" });
    console.log("✅ Slash commands deployed.");
  } catch (err) {
    console.error("❌ Failed to deploy commands:", err);
  }
}


/* ===================== DISCORD CLIENT ===================== */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "DM to open Ticket", type: 2 }],
    status: "dnd",
  });

  try {
    await organizeCasesToFolder(await loadAllCases());
  } catch {}
});
/* ===================== INTERACTIONS ===================== */
import { handleLevelRoleComponents } from "./profile/level/core.js";
import { handleModmailCore } from "./modmail/core.js";
import { routeInteraction } from "./router.js";

client.on("interactionCreate", async interaction => {
  try {
    /* ===================== COMPONENT INTERACTIONS ===================== */
    // Let global component handlers run if they want to
    if (await handleLevelRoleComponents(interaction)) return;
    if (await handleModmailCore(interaction)) return;

    /* ===================== SLASH COMMANDS ===================== */
    // IMPORTANT: do NOT return for non-chat interactions

    if (interaction.isChatInputCommand()) {
      if (!interaction.inGuild()) {
        return interaction.reply({
          content: "❌ This command can only be used in a server.",
          ephemeral: true,
        });
      }

      await routeInteraction(interaction);
    }

  } catch (err) {
    console.error("❌ Interaction handler crash:", err);

    if (interaction.isRepliable() && !interaction.replied) {
      await interaction.reply({
        content: "❌ An unexpected error occurred.",
        ephemeral: true,
      });
    }
  }
});





/* ===================== MESSAGE CREATE ===================== */

client.on("messageCreate", async message => {
  // 🔢 Counting system (hard-gated by setup)
  await handleCounting(message);

  // ⛔ Ignore bots for everything else
  if (message.author.bot) return;

  // (You can add more message-based logic here later if needed)
});


/* ===================== LOGIN ===================== */

if (!process.env.DISCORD_BOT_TOKEN) {
  console.error("❌ DISCORD_BOT_TOKEN missing");
  process.exit(1);
}

client.login(process.env.DISCORD_BOT_TOKEN);
client.player = setupPlayer(client);


