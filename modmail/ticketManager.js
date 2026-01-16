import crypto from "crypto";
import { ChannelType, EmbedBuilder } from "discord.js";
import { pool } from "../database/mysql.js";
import { loadModmailConfig } from "./config.js";

const TICKETS_TABLE = "modmail_tickets";
const APPEALS_TABLE = "modmail_appeals";

async function ensureTicketsTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${TICKETS_TABLE}\` (
      id CHAR(36) NOT NULL PRIMARY KEY,
      guild_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      type VARCHAR(64) NOT NULL,
      topic TEXT NOT NULL,
      thread_id VARCHAR(32) NOT NULL,
      created_at BIGINT NOT NULL,
      last_message_at BIGINT NOT NULL,
      last_message_id VARCHAR(32) NULL,
      KEY idx_user_id (user_id),
      KEY idx_thread_id (thread_id),
      KEY idx_last_message_at (last_message_at)
    )`
  );
}

async function ensureAppealsTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${APPEALS_TABLE}\` (
      guild_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      appeal_count INT NOT NULL DEFAULT 0,
      last_appeal_at BIGINT NULL,
      PRIMARY KEY (guild_id, user_id)
    )`
  );
}

export async function createTicket({ guildId, userId, type, topic, client }) {
  const config = await loadModmailConfig(guildId);
  if (!config?.enabled) throw new Error();

  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error();

  const forum = guild.channels.cache.get(config.forumChannelId);
  if (!forum || forum.type !== ChannelType.GuildForum) throw new Error();

  const embed = new EmbedBuilder()
    .setTitle(`📨 ${type}`)
    .addFields(
      { name: "User", value: `<@${userId}> (${userId})` },
      { name: "Topic", value: topic }
    )
    .setTimestamp();

  const typeTags = config.ticketTypes?.[type]?.tags ?? [];
  const appliedTags = Array.from(
    new Set([...(Array.isArray(typeTags) ? typeTags : []), config.tags?.open])
  ).filter(Boolean);

  const thread = await forum.threads.create({
    name: `${type} -- ${userId}`,
    message: { embeds: [embed] },
    appliedTags,
  });

  await ensureTicketsTable();
  const ticketId = crypto.randomUUID();
  const now = Date.now();
  await pool.query(
    `INSERT INTO \`${TICKETS_TABLE}\`
     (id, guild_id, user_id, type, topic, thread_id, created_at, last_message_at, last_message_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [ticketId, guildId, userId, type, topic, thread.id, now, now, null]
  );

  return {
    id: ticketId,
    guildId,
    userId,
    type,
    topic,
    threadId: thread.id,
    createdAt: now,
    lastMessageAt: now,
  };
}

export async function getAppealCount(guildId, userId) {
  await ensureAppealsTable();
  const [[row]] = await pool.query(
    `SELECT appeal_count
     FROM \`${APPEALS_TABLE}\`
     WHERE guild_id = ? AND user_id = ?`,
    [guildId, userId]
  );
  return row?.appeal_count ?? 0;
}

export async function incrementAppealCount(guildId, userId) {
  await ensureAppealsTable();
  await pool.query(
    `INSERT INTO \`${APPEALS_TABLE}\`
     (guild_id, user_id, appeal_count, last_appeal_at)
     VALUES (?, ?, 1, ?)
     ON DUPLICATE KEY UPDATE
       appeal_count = appeal_count + 1,
       last_appeal_at = VALUES(last_appeal_at)`,
    [guildId, userId, Date.now()]
  );
}

export async function getTicketByThreadId(threadId) {
  await ensureTicketsTable();
  const [[row]] = await pool.query(
    `SELECT *
     FROM \`${TICKETS_TABLE}\`
     WHERE thread_id = ?`,
    [threadId]
  );
  if (!row) return null;
  return {
    id: row.id,
    guildId: row.guild_id,
    userId: row.user_id,
    type: row.type,
    topic: row.topic,
    threadId: row.thread_id,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
    lastMessageId: row.last_message_id,
  };
}

export async function updateTicketActivity(threadId, messageId) {
  await ensureTicketsTable();
  await pool.query(
    `UPDATE \`${TICKETS_TABLE}\`
     SET last_message_at = ?, last_message_id = ?
     WHERE thread_id = ?`,
    [Date.now(), messageId ?? null, threadId]
  );
}

export async function removeTicketByThreadId(threadId) {
  await ensureTicketsTable();
  await pool.query(
    `DELETE FROM \`${TICKETS_TABLE}\`
     WHERE thread_id = ?`,
    [threadId]
  );
}

export async function sweepInactiveTickets(client, cutoffMs) {
  await ensureTicketsTable();
  const threshold = Date.now() - cutoffMs;
  const [rows] = await pool.query(
    `SELECT thread_id
     FROM \`${TICKETS_TABLE}\`
     WHERE last_message_at <= ?`,
    [threshold]
  );

  for (const row of rows) {
    const threadId = row.thread_id;
    const thread = await client.channels.fetch(threadId).catch(() => null);
    if (thread) {
      await thread.delete("Modmail ticket inactive for 24h").catch(() => {});
    }
    await removeTicketByThreadId(threadId);
  }
}
