import { ChannelType } from "discord.js";

import { pool } from "../database/mysql.js";
import { getGuildTableName } from "../database/tableNames.js";

const WEBHOOK_NAME = "Auto Webhook";
const WEBHOOK_SYNC_INTERVAL_MS = 30 * 60 * 1000;

async function ensureWebhookTable(guild) {
  const tableName = getGuildTableName(guild, "webhooks");
  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      channel_id VARCHAR(32) NOT NULL PRIMARY KEY,
      channel_name VARCHAR(100) NOT NULL,
      webhook_id VARCHAR(32) NOT NULL,
      webhook_token VARCHAR(255) NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_webhook_id (webhook_id)
    )`
  );
  return tableName;
}

async function upsertWebhookRecord(tableName, channel, webhook) {
  await pool.query(
    `INSERT INTO \`${tableName}\`
     (channel_id, channel_name, webhook_id, webhook_token)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       channel_name = VALUES(channel_name),
       webhook_id = VALUES(webhook_id),
       webhook_token = VALUES(webhook_token)`,
    [channel.id, channel.name, webhook.id, webhook.token]
  );
}

async function loadWebhookRow(tableName, channelId) {
  const [rows] = await pool.query(
    `SELECT webhook_id, webhook_token
     FROM \`${tableName}\`
     WHERE channel_id = ?`,
    [channelId]
  );
  return rows[0] ?? null;
}

async function ensureWebhookForChannel(tableName, channel) {
  const existing = await loadWebhookRow(tableName, channel.id);
  let webhook = null;

  if (existing?.webhook_id) {
    const webhooks = await channel.fetchWebhooks().catch(() => null);
    webhook = webhooks?.get(existing.webhook_id) ?? null;
  }

  if (!webhook) {
    webhook = await channel
      .createWebhook({ name: WEBHOOK_NAME })
      .catch(() => null);
  }

  if (!webhook?.id || !webhook?.token) return;

  await upsertWebhookRecord(tableName, channel, webhook);
}

function isEligibleChannel(channel) {
  return [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(
    channel.type
  );
}

export async function syncWebhooksForGuild(guild) {
  if (!guild) return;

  const tableName = await ensureWebhookTable(guild);
  const channels =
    (await guild.channels.fetch().catch(() => null)) ?? guild.channels.cache;
  const textChannels = [...channels.values()].filter(isEligibleChannel);

  for (const channel of textChannels) {
    try {
      await ensureWebhookForChannel(tableName, channel);
    } catch (err) {
      console.error(
        `❌ Failed to sync webhook for channel ${channel.id}:`,
        err
      );
    }
  }

  const channelIds = textChannels.map(channel => channel.id);
  if (!channelIds.length) {
    await pool.query(`DELETE FROM \`${tableName}\``);
    return;
  }

  await pool.query(
    `DELETE FROM \`${tableName}\`
     WHERE channel_id NOT IN (?)`,
    [channelIds]
  );
}

export async function syncWebhooksForAllGuilds(client) {
  if (!client) return;
  const guilds = [...client.guilds.cache.values()];
  for (const guild of guilds) {
    try {
      await syncWebhooksForGuild(guild);
    } catch (err) {
      console.error(`❌ Failed to sync webhooks for guild ${guild.id}:`, err);
    }
  }
}

export function startWebhooksCron(client) {
  setInterval(() => {
    syncWebhooksForAllGuilds(client).catch(err => {
      console.error("❌ Webhook sync cron failed:", err);
    });
  }, WEBHOOK_SYNC_INTERVAL_MS);
}
