// index.js (Main)
import "dotenv/config";
import fs from "fs/promises";
import bcrypt from "bcrypt";
import { execSync } from "child_process";
import { existsSync } from "fs";

import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
  Partials,
} from "discord.js";

import { organizeCasesToFolder } from "./moderation/organize-cases.js";
import { ensureDataPath } from "./utils/storage.js";
import {
  getAllStaffConfigsSorted,
  getStaffConfig,
  initStaffConfigCache,
} from "./moderation/staffConfig.js";
import {
  removeMemberStaffRoleAssignments,
  syncAllStaffRoleAssignments,
  syncGuildStaffRoleAssignments,
  syncMemberStaffRoleAssignments,
} from "./moderation/staffRoleAssignments.js";

import { handleCounting } from "./counting/index.js";
import { handleLeveling } from "./profile/level/index.js";

import {
  handleLevelRoleComponents,
  handleLevelRoleMessage,
} from "./profile/level/core.js";
import { handleModmailCore } from "./modmail/core.js";
import { initModmail } from "./modmail/index.js";
import { routeInteraction } from "./router.js";

import { testDatabaseConnection } from "./database/mysql.js";

await testDatabaseConnection();
await initStaffConfigCache();
const staffConfigs = getAllStaffConfigsSorted();


/* ===================== PRE-FLIGHT ===================== */

console.log(execSync("which ffmpeg").toString());
console.log(execSync("ffmpeg -version").toString());

await ensureDataPath();

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
    GatewayIntentBits.DirectMessages, // REQUIRED for ModMail
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User],
});

/* ===================== MODMAIL INIT ===================== */

initModmail(client);

/* ===================== READY ===================== */

client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: "DM to open Ticket", type: 2 }],
    status: "dnd",
  });

  try {
    await organizeCasesToFolder();
  } catch {
    // case sync must never crash startup
  }

  const guildConfigs = [];
  for (const config of staffConfigs) {
    const guild =
      client.guilds.cache.get(config.guildId) ??
      (await client.guilds.fetch(config.guildId).catch(() => null));
    if (!guild) continue;
    guildConfigs.push({ guild, staffRoles: config.staffRoles });
  }

  try {
    await syncAllStaffRoleAssignments(guildConfigs);
  } catch (err) {
    console.error("❌ Failed to sync global staff role assignments:", err);
  }
});

/* ===================== INTERACTIONS ===================== */

client.on("interactionCreate", async interaction => {
  try {
    /* ===================== COMPONENTS ===================== */

    if (await handleLevelRoleComponents(interaction)) return;
    if (await handleModmailCore(interaction)) return;

    /* ===================== SLASH COMMANDS ===================== */

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
  if (message.author.bot) return;

  await handleLevelRoleMessage(message);

  // 🔢 Counting system (setup-gated)
  await handleCounting(message);

  // ⭐ Leveling system (always active)
  await handleLeveling(message);
});

/* ===================== STAFF ROLE TRACKING ===================== */

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  const config = await getStaffConfig(newMember.guild);
  if (!config?.staffRoles?.length) return;
  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;
  const staffRoleIds = config.staffRoles.map(role => role.roleId);
  const changed = staffRoleIds.some(roleId => {
    return oldRoles.has(roleId) !== newRoles.has(roleId);
  });
  if (!changed) return;
  await syncMemberStaffRoleAssignments(newMember, config.staffRoles);
});

client.on(Events.GuildMemberRemove, async member => {
  await removeMemberStaffRoleAssignments(member.guild.id, member.id);
});

/* ===================== LOGIN ===================== */

if (!process.env.DISCORD_BOT_TOKEN) {
  console.error("❌ DISCORD_BOT_TOKEN missing");
  process.exit(1);
}

await client.login(process.env.DISCORD_BOT_TOKEN);

/* ===================== OPTIONAL MUSIC PLAYER ===================== */
/*
import { setupPlayer } from "./music/player.js";
client.player = setupPlayer(client);
*/
