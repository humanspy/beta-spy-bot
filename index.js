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
  ChannelType,
  PermissionFlagsBits,
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
import {
  registerInviteSyncCommand,
  startInviteCron,
} from "./invite-handler/index.js";
import {
  registerAnnouncementSyncCommand,
  startAnnouncementCron,
  verifyAnnouncementFollower,
} from "./announcement-handler/index.js";

import { testDatabaseConnection } from "./database/mysql.js";
import { purgeGuildData } from "./utils/purgeGuildData.js";

await testDatabaseConnection();
await initStaffConfigCache();
const staffConfigs = getAllStaffConfigsSorted();
const ANNOUNCEMENT_SOURCE_GUILD_ID = "1114470427960557650";
const ANNOUNCEMENT_SOURCE_CHANNEL_ID = "1464318652273922058";
const ANNOUNCEMENT_TARGET_CHANNEL_NAME = "sgi-core-announcements";
const ANNOUNCEMENT_HEALTHCHECK_INTERVAL_MS = 60 * 60 * 1000;

const ensureAnnouncementFollowersTable = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS announcement_followers (
      guild_id BIGINT PRIMARY KEY,
      channel_id BIGINT NULL,
      is_followed BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );
  const [columns] = await pool.query(
    "SHOW COLUMNS FROM `announcement_followers`"
  );
  const columnNames = new Set(columns.map(col => col.Field));
  if (!columnNames.has("is_followed")) {
    await pool.query(
      "ALTER TABLE `announcement_followers` ADD COLUMN is_followed BOOLEAN DEFAULT FALSE"
    );
  }
  if (!columnNames.has("channel_id")) {
    await pool.query(
      "ALTER TABLE `announcement_followers` ADD COLUMN channel_id BIGINT NULL"
    );
  }
};

const getAnnouncementSourceChannel = async client => {
  const channel = await client.channels
    .fetch(ANNOUNCEMENT_SOURCE_CHANNEL_ID)
    .catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildAnnouncement) {
    return null;
  }
  return channel;
};

const ensureAnnouncementChannel = async (guild, channelId = null) => {
  if (!guild) return null;
  if (channelId) {
    const existingById = await guild.channels.fetch(channelId).catch(() => null);
    if (existingById?.type === ChannelType.GuildText) {
      const everyoneRoleId = guild.roles.everyone.id;
      const permissions =
        existingById.permissionOverwrites.cache.get(everyoneRoleId);
      if (!permissions?.deny?.has(PermissionFlagsBits.ViewChannel)) {
        await existingById.permissionOverwrites.edit(everyoneRoleId, {
          ViewChannel: false,
        });
      }
      return existingById;
    }
  }
  const existing = guild.channels.cache.find(channel => {
    return (
      channel.type === ChannelType.GuildText &&
      channel.name === ANNOUNCEMENT_TARGET_CHANNEL_NAME
    );
  });

  if (existing) {
    const everyoneRoleId = guild.roles.everyone.id;
    const permissions = existing.permissionOverwrites.cache.get(everyoneRoleId);
    if (!permissions?.deny?.has(PermissionFlagsBits.ViewChannel)) {
      await existing.permissionOverwrites.edit(everyoneRoleId, {
        ViewChannel: false,
      });
    }
    return existing;
  }

  return guild.channels.create({
    name: ANNOUNCEMENT_TARGET_CHANNEL_NAME,
    type: ChannelType.GuildText,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
    ],
  });
};

const followAnnouncementChannel = async (client, guild) => {
  if (guild.id === ANNOUNCEMENT_SOURCE_GUILD_ID) {
    return;
  }
  await ensureAnnouncementFollowersTable();
  const sourceChannel = await getAnnouncementSourceChannel(client);
  if (!sourceChannel) {
    console.log(`[Announcements] ${guild.name}: FAIL`);
    return;
  }
  let followedStatus = false;
  const [[row]] = await pool
    .query(
      "SELECT channel_id FROM announcement_followers WHERE guild_id = ?",
      [guild.id]
    )
    .catch(() => [null]);
  const storedChannelId = row?.channel_id ?? null;
  const targetChannel = await ensureAnnouncementChannel(
    guild,
    storedChannelId
  ).catch(() => null);
  if (!targetChannel) {
    await pool.query(
      `INSERT INTO announcement_followers (guild_id, channel_id, is_followed)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         channel_id = VALUES(channel_id),
         is_followed = VALUES(is_followed)`,
      [guild.id, storedChannelId, false]
    );
    console.log(`[Announcements] ${guild.name}: FAIL`);
    return;
  }
  const followers = await sourceChannel.fetchFollowers().catch(() => null);
  const alreadyFollowing = followers?.some(follower => {
    return follower.channelId === targetChannel.id;
  });
  if (!alreadyFollowing) {
    try {
      await sourceChannel.addFollower(targetChannel.id);
      followedStatus = true;
    } catch {
      followedStatus = false;
    }
  } else {
    followedStatus = true;
  }
  await pool.query(
    `INSERT INTO announcement_followers (guild_id, channel_id, is_followed)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       channel_id = VALUES(channel_id),
       is_followed = VALUES(is_followed)`,
    [guild.id, targetChannel.id, followedStatus]
  );
  console.log(
    `[Announcements] ${guild.name}: ${followedStatus ? "SUCCESS" : "FAIL"}`
  );
};

const purgeGuildData = async guildId => {
  try {
    const [[dbRow]] = await pool.query("SELECT DATABASE() AS db");
    const dbName = dbRow?.db;
    if (!dbName) return;

    try {
      await pool.query("DELETE FROM `invites` WHERE guild_id = ?", [guildId]);
    } catch (err) {
      console.error("❌ Failed to purge invites table:", err);
    }

    try {
      await pool.query(
        "DELETE FROM `announcement_followers` WHERE guild_id = ?",
        [guildId]
      );
    } catch (err) {
      console.error("❌ Failed to purge announcement followers table:", err);
    }

    const [guildIdTables] = await pool.query(
      `SELECT DISTINCT TABLE_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND COLUMN_NAME = 'guild_id'`,
      [dbName]
    );

    for (const { TABLE_NAME: tableName } of guildIdTables) {
      if (!/^[A-Za-z0-9_]+$/.test(tableName)) continue;
      try {
        await pool.query(`DELETE FROM \`${tableName}\` WHERE guild_id = ?`, [
          guildId,
        ]);
      } catch (err) {
        console.error(`❌ Failed to purge guild data in ${tableName}:`, err);
      }
    }

    const [dynamicTables] = await pool.query(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME LIKE ?`,
      [dbName, `%${guildId}%`]
    );

    for (const { TABLE_NAME: tableName } of dynamicTables) {
      if (!/^[A-Za-z0-9_]+$/.test(tableName)) continue;
      try {
        await pool.query(`DROP TABLE \`${tableName}\``);
      } catch (err) {
        console.error(`❌ Failed to drop table ${tableName}:`, err);
      }
    }
  } catch (err) {
    console.error("❌ Guild data purge failed:", err);
  }
};

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

  try {
    await registerInviteSyncCommand();
  } catch (err) {
    console.error("❌ Failed to register invite sync command:", err);
  }

  try {
    await registerAnnouncementSyncCommand();
  } catch (err) {
    console.error("❌ Failed to register announcement sync command:", err);
  }

  startAnnouncementCron(client);

  startInviteCron(client);
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

client.on(Events.GuildCreate, async guild => {
  await verifyAnnouncementFollower(client, guild).catch(() => null);
});

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

client.on(Events.GuildDelete, async guild => {
  await purgeGuildData(guild.id);
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
