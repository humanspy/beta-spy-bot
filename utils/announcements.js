import { ChannelType } from "discord.js";

import { pool } from "../database/mysql.js";

const SOURCE_GUILD_ID = "1114470427960557650";
const SOURCE_CHANNEL_ID = "1464318652273922058";
const ANNOUNCEMENTS_SYNC_INTERVAL_MS = 3 * 60 * 60 * 1000;

const ensureAnnouncementsTable = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS announcements (
      guild_id BIGINT PRIMARY KEY,
      guild_name VARCHAR(255) NOT NULL,
      channel_id BIGINT NOT NULL,
      followed BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
    )`
  );
};

const resolveCommunityUpdatesChannel = async guild => {
  if (guild.publicUpdatesChannel) {
    return guild.publicUpdatesChannel;
  }

  if (guild.publicUpdatesChannelId) {
    const channel = await guild.channels
      .fetch(guild.publicUpdatesChannelId)
      .catch(() => null);
    if (channel) return channel;
  }

  const channels =
    (await guild.channels.fetch().catch(() => null)) ??
    guild.channels.cache;
  const announcementChannels = [...channels.values()].filter(
    channel => channel?.type === ChannelType.GuildAnnouncement
  );
  if (!announcementChannels.length) return null;

  const namedChannel = announcementChannels.find(channel => {
    const name = (channel.name ?? "").toLowerCase();
    return name.includes("community") && name.includes("update");
  });

  return namedChannel ?? announcementChannels[0];
};

const saveAnnouncementRecord = async (guild, channel, followed) => {
  await pool.query(
    `INSERT INTO announcements (guild_id, guild_name, channel_id, followed)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       guild_name = VALUES(guild_name),
       channel_id = VALUES(channel_id),
       followed = VALUES(followed)`,
    [guild.id, guild.name, channel.id, followed]
  );
};

const followSourceChannel = async (client, targetChannel) => {
  if (!targetChannel) return false;
  if (targetChannel.guild?.id === SOURCE_GUILD_ID) {
    return false;
  }
  if (
    ![ChannelType.GuildAnnouncement, ChannelType.GuildText].includes(
      targetChannel.type
    )
  ) {
    return false;
  }

  const sourceChannel = await client.channels
    .fetch(SOURCE_CHANNEL_ID)
    .catch(() => null);
  if (!sourceChannel || sourceChannel.type !== ChannelType.GuildAnnouncement) {
    return false;
  }

  await sourceChannel.addFollower(
    targetChannel,
    `Follow announcements for guild ${targetChannel.guild?.id ?? "unknown"}`
  );
  return true;
};

export const syncAnnouncementsForGuild = async (client, guild) => {
  if (!guild) return;
  if (guild.id === SOURCE_GUILD_ID) return;

  await ensureAnnouncementsTable();
  const updatesChannel = await resolveCommunityUpdatesChannel(guild);
  if (!updatesChannel) {
    console.warn(
      `⚠️ No community updates channel found for guild ${guild.id}`
    );
    return;
  }

  await saveAnnouncementRecord(guild, updatesChannel, false);

  const followed = await followSourceChannel(client, updatesChannel).catch(
    () => false
  );
  if (followed) {
    await saveAnnouncementRecord(guild, updatesChannel, true);
  }
};

export const syncAnnouncementsForAllGuilds = async client => {
  const guilds = [...client.guilds.cache.values()];
  for (const guild of guilds) {
    try {
      await syncAnnouncementsForGuild(client, guild);
    } catch (err) {
      console.error(
        `❌ Failed to sync announcements for guild ${guild.id}:`,
        err
      );
    }
  }
};

export const startAnnouncementsCron = client => {
  setInterval(() => {
    syncAnnouncementsForAllGuilds(client).catch(err => {
      console.error("❌ Announcements sync cron failed:", err);
    });
  }, ANNOUNCEMENTS_SYNC_INTERVAL_MS);
};
