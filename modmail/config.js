import { pool } from "../database/mysql.js";

const TABLE_NAME = "modmail_config";

async function ensureModmailConfigTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${TABLE_NAME}\` (
      guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      forum_channel_id VARCHAR(32) NULL,
      anonymous_staff TINYINT(1) NOT NULL DEFAULT 0,
      appeal_limit INT NOT NULL DEFAULT 0,
      ticket_types_json JSON NULL,
      tags_json JSON NULL,
      updated_at BIGINT NOT NULL
    )`
  );
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

export async function loadModmailConfig(guildId) {
  await ensureModmailConfigTable();
  const [[row]] = await pool.query(
    `SELECT *
     FROM \`${TABLE_NAME}\`
     WHERE guild_id = ?`,
    [guildId]
  );
  if (!row) return null;
  return {
    enabled: Boolean(row.enabled),
    forumChannelId: row.forum_channel_id,
    anonymousStaff: Boolean(row.anonymous_staff),
    appealLimit: row.appeal_limit ?? 0,
    ticketTypes: parseJson(row.ticket_types_json, {}),
    tags: parseJson(row.tags_json, {}),
  };
}

export async function getEnabledModmailGuildIds() {
  await ensureModmailConfigTable();
  const [rows] = await pool.query(
    `SELECT guild_id
     FROM \`${TABLE_NAME}\`
     WHERE enabled = 1`
  );
  return rows.map(row => row.guild_id);
}

export async function saveModmailConfig(guildId, config) {
  await ensureModmailConfigTable();
  await pool.query(
    `INSERT INTO \`${TABLE_NAME}\`
     (guild_id, enabled, forum_channel_id, anonymous_staff, appeal_limit, ticket_types_json, tags_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       enabled = VALUES(enabled),
       forum_channel_id = VALUES(forum_channel_id),
       anonymous_staff = VALUES(anonymous_staff),
       appeal_limit = VALUES(appeal_limit),
       ticket_types_json = VALUES(ticket_types_json),
       tags_json = VALUES(tags_json),
       updated_at = VALUES(updated_at)`,
    [
      guildId,
      config?.enabled ? 1 : 0,
      config?.forumChannelId ?? null,
      config?.anonymousStaff ? 1 : 0,
      config?.appealLimit ?? 0,
      JSON.stringify(config?.ticketTypes ?? {}),
      JSON.stringify(config?.tags ?? {}),
      Date.now(),
    ]
  );
}
