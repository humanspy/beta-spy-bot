import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";

import { pool } from "../database/mysql.js";
import { getStaffConfig } from "../moderation/staffConfig.js";
import { guildCommands } from "../guild-commands.js";

const ANNOUNCEMENT_SOURCE_GUILD_ID = "1114470427960557650";
const ANNOUNCEMENT_SOURCE_CHANNEL_ID = "1464318652273922058";
const ANNOUNCEMENT_TARGET_CHANNEL_NAME = "sgi-core-announcements";
const ANNOUNCEMENT_SYNC_GUILD_ID = "1114470427960557650";
const ANNOUNCEMENT_SYNC_COMMAND = "announcement-sync";
const ANNOUNCEMENT_HEALTHCHECK_INTERVAL_MS = 30 * 60 * 1000;

const ensureAnnouncementFollowersTable = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS announcement_followers (
      guild_id BIGINT PRIMARY KEY,
      channel_id BIGINT NULL,
      is_followed BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );
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

const getAnnouncementSyncRoles = config => {
  return (config?.staffRoles ?? [])
    .filter(role => {
      const perms = role.permissions;
      if (!perms) return false;
      if (perms === "all") return true;
      return Array.isArray(perms) && perms.includes("all");
    })
    .map(role => role.roleId);
};

const buildAnnouncementSyncCommand = () =>
  new SlashCommandBuilder()
    .setName(ANNOUNCEMENT_SYNC_COMMAND)
    .setDescription("Sync announcement followers for all guilds");

export const verifyAnnouncementFollower = async (client, guild) => {
  if (guild.id === ANNOUNCEMENT_SOURCE_GUILD_ID) {
    return;
  }
  await ensureAnnouncementFollowersTable();
  const [[row]] = await pool
    .query(
      "SELECT channel_id FROM announcement_followers WHERE guild_id = ?",
      [guild.id]
    )
    .catch(() => [null]);
  const storedChannelId = row?.channel_id ?? null;
  const sourceGuild = await client.guilds
    .fetch(ANNOUNCEMENT_SOURCE_GUILD_ID)
    .catch(() => null);
  const sourceChannel = await sourceGuild?.channels
    .fetch(ANNOUNCEMENT_SOURCE_CHANNEL_ID)
    .catch(() => null);
  if (!sourceChannel || sourceChannel.type !== ChannelType.GuildAnnouncement) {
    console.error(
      "[Announcements] Source channel is invalid or not a News channel:",
      ANNOUNCEMENT_SOURCE_CHANNEL_ID
    );
    await pool.query(
      `INSERT INTO announcement_followers (guild_id, channel_id, is_followed)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         channel_id = VALUES(channel_id),
         is_followed = VALUES(is_followed)`,
      [guild.id, storedChannelId, false]
    );
    console.log(`[Announcements] ${guild.name}: FAIL`);
    return false;
  }
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
    return false;
  }

  let followedStatus = false;
  let followers;
  try {
    if (typeof sourceChannel.fetchFollowers !== "function") {
      throw new TypeError("fetchFollowers is not available on source channel");
    }
    followers = await sourceChannel.fetchFollowers();
  } catch (error) {
    if (error?.code === 50013) {
      console.warn(
        "[Announcements] Missing ManageWebhooks permission to fetch followers."
      );
    } else {
      console.error(
        "[Announcements] Failed to fetch announcement followers:",
        error
      );
    }
    await pool.query(
      `INSERT INTO announcement_followers (guild_id, channel_id, is_followed)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         channel_id = VALUES(channel_id),
         is_followed = VALUES(is_followed)`,
      [guild.id, targetChannel.id, false]
    );
    console.log(`[Announcements] ${guild.name}: FAIL`);
    return false;
  }
  const alreadyFollowing =
    followers.has(targetChannel.id) ||
    followers.some(follower => follower.channelId === targetChannel.id);
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
  return followedStatus;
};

export const verifyAnnouncementsForAllGuilds = async client => {
  console.log("[Announcements] Starting 30-minute health check...");
  let processed = 0;
  for (const guild of client.guilds.cache.values()) {
    try {
      await verifyAnnouncementFollower(client, guild);
    } catch (err) {
      console.error(
        `❌ Announcement verification failed for ${guild.id}:`,
        err
      );
    }
    processed += 1;
  }
  console.log("[Announcements] Health check complete.");
  return { processed };
};

export const startAnnouncementCron = client => {
  verifyAnnouncementsForAllGuilds(client).catch(err => {
    console.error("❌ Announcement health check failed:", err);
  });
  setInterval(() => {
    verifyAnnouncementsForAllGuilds(client).catch(err => {
      console.error("❌ Announcement health check failed:", err);
    });
  }, ANNOUNCEMENT_HEALTHCHECK_INTERVAL_MS);
};

export const registerAnnouncementSyncCommand = async () => {
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CLIENT_ID) {
    console.warn("⚠️ Missing DISCORD_CLIENT_ID or DISCORD_BOT_TOKEN.");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(
    process.env.DISCORD_BOT_TOKEN
  );

  const commands = [...guildCommands, buildAnnouncementSyncCommand()];
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.DISCORD_CLIENT_ID,
      ANNOUNCEMENT_SYNC_GUILD_ID
    ),
    { body: commands }
  );
};

export const handleAnnouncementSyncCommand = async (interaction, client) => {
  if (!interaction.isChatInputCommand()) return false;
  if (interaction.commandName !== ANNOUNCEMENT_SYNC_COMMAND) return false;
  if (interaction.guildId !== ANNOUNCEMENT_SYNC_GUILD_ID) {
    await interaction.reply({
      content: "❌ This command is not available in this server.",
      flags: 64,
    });
    return true;
  }

  const config = await getStaffConfig(interaction.guild);
  const allowedRoles = getAnnouncementSyncRoles(config);
  const memberRoles = interaction.member?.roles?.cache;
  const hasRole =
    memberRoles &&
    allowedRoles.some(roleId => memberRoles.has(roleId));

  if (!hasRole) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ Missing Permission")
          .setDescription(
            "You do not have permission to sync announcements."
          ),
      ],
      flags: 64,
    });
    return true;
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🔄 Syncing Announcements")
        .setDescription("Syncing announcement followers for all guilds..."),
    ],
    flags: 64,
  });

  const { processed } = await verifyAnnouncementsForAllGuilds(client);

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("✅ Announcement Sync Complete")
        .setDescription(`Processed **${processed}** guild(s).`),
    ],
  });
  return true;
};

export const shouldIncludeAnnouncementSyncCommand = guildId =>
  guildId === ANNOUNCEMENT_SYNC_GUILD_ID;

export const getAnnouncementSyncCommandDefinition = () =>
  buildAnnouncementSyncCommand();
