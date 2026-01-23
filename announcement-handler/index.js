import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  WebhookClient,
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
const announcementWebhookCache = new Map();

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

const getAnnouncementWebhookClient = async (
  channel,
  webhookName,
  webhookAvatar
) => {
  const cached = announcementWebhookCache.get(channel.id);
  if (cached?.name === webhookName) {
    return cached.client;
  }

  const hooks = await channel.fetchWebhooks().catch(() => null);
  let hook = hooks?.find(existing => existing.name === webhookName) ?? null;

  if (!hook) {
    hook = await channel
      .createWebhook({
        name: webhookName,
        avatar: webhookAvatar ?? undefined,
      })
      .catch(() => null);
  }

  if (!hook?.url) return null;

  const client = new WebhookClient({ url: hook.url });
  announcementWebhookCache.set(channel.id, { name: webhookName, client });
  return client;
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
    .setDescription("Heal announcement channels for all guilds");

export const verifyAnnouncementFollower = async (client, guild) => {
  if (guild.id === ANNOUNCEMENT_SOURCE_GUILD_ID) {
    return false;
  }
  await ensureAnnouncementFollowersTable();
  const [[row]] = await pool
    .query(
      "SELECT channel_id FROM announcement_followers WHERE guild_id = ?",
      [guild.id]
    )
    .catch(() => [null]);
  const storedChannelId = row?.channel_id ?? null;
  let existingChannel = null;
  if (storedChannelId) {
    existingChannel = await guild.channels
      .fetch(storedChannelId)
      .catch(() => null);
  }
  const targetChannel = await ensureAnnouncementChannel(
    guild,
    existingChannel?.id ?? null
  ).catch(() => null);
  let followedStatus = false;
  if (targetChannel) {
    const sourceGuild = await client.guilds
      .fetch(ANNOUNCEMENT_SOURCE_GUILD_ID)
      .catch(() => null);
    const webhookName = sourceGuild?.name ?? "Announcements";
    const webhookAvatar = sourceGuild?.iconURL?.({ extension: "png" }) ?? null;
    try {
      const webhook = await getAnnouncementWebhookClient(
        targetChannel,
        webhookName,
        webhookAvatar
      );
      followedStatus = Boolean(webhook);
    } catch (error) {
      if (error?.code === 50013) {
        console.warn(
          "[Announcements] Missing ManageWebhooks permission for:",
          guild.name
        );
      } else {
        console.error(
          "[Announcements] Failed to init announcement webhook for:",
          guild.name,
          error
        );
      }
      followedStatus = false;
    }
  }
  await pool.query(
    `INSERT INTO announcement_followers (guild_id, channel_id, is_followed)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       channel_id = VALUES(channel_id),
       is_followed = VALUES(is_followed)`,
    [guild.id, targetChannel?.id ?? storedChannelId, followedStatus]
  );

  console.log(
    `[Announcements] ${guild.name}: ${followedStatus ? "SUCCESS" : "FAIL"}`
  );
  return followedStatus;
};

export const handleAnnouncementMessageCreate = async message => {
  if (!message?.guildId) return false;
  if (message.channelId !== ANNOUNCEMENT_SOURCE_CHANNEL_ID) return false;
  if (message.author?.bot) return false;

  await ensureAnnouncementFollowersTable();
  const sourceGuild = await message.client.guilds
    .fetch(ANNOUNCEMENT_SOURCE_GUILD_ID)
    .catch(() => null);
  const webhookName = sourceGuild?.name ?? "Announcements";
  const webhookAvatar = sourceGuild?.iconURL?.({ extension: "png" }) ?? null;
  const [rows] = await pool
    .query(
      "SELECT channel_id FROM announcement_followers WHERE channel_id IS NOT NULL AND is_followed = TRUE"
    )
    .catch(() => [null]);
  if (!rows?.length) return false;

  const files = message.attachments.map(attachment => attachment.url);
  const embeds = message.embeds?.length ? message.embeds : undefined;
  const content = message.content || undefined;
  if (!content && !embeds && files.length === 0) return false;

  for (const row of rows) {
    try {
      const channelId = row?.channel_id;
      if (!channelId || channelId === ANNOUNCEMENT_SOURCE_CHANNEL_ID) continue;
      const targetChannel = await message.client.channels
        .fetch(channelId)
        .catch(() => null);
      if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
        continue;
      }
      const webhook = await getAnnouncementWebhookClient(
        targetChannel,
        webhookName,
        webhookAvatar
      );
      if (!webhook) continue;
      await webhook.send({
        content,
        embeds,
        files: files.length ? files : undefined,
        username: webhookName,
        avatarURL: webhookAvatar ?? undefined,
      });
    } catch (error) {
      console.error(
        "[Announcements] Failed to broadcast to follower channel:",
        row?.channel_id,
        error
      );
    }
  }

  return true;
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
        .setDescription("Healing announcement channels for all guilds..."),
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
