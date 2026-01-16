import { pool } from "../../database/mysql.js";
import { getGuildTableName } from "../../database/tableNames.js";

async function ensureXpTable(guild) {
  const tableName = getGuildTableName(guild, "xp");
  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      user_id VARCHAR(32) NOT NULL PRIMARY KEY,
      xp INT NOT NULL DEFAULT 0,
      level INT NOT NULL DEFAULT 0,
      messages INT NOT NULL DEFAULT 0,
      last_message BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
    )`
  );
  return tableName;
}

export async function getUserData(guild, userId) {
  const tableName = await ensureXpTable(guild);
  const [rows] = await pool.query(
    `SELECT xp, level, messages, last_message
     FROM \`${tableName}\`
     WHERE user_id = ?`,
    [userId]
  );

  if (!rows.length) {
    const defaults = {
      xp: 0,
      level: 0,
      messages: 0,
      lastMessage: 0,
    };
    await pool.query(
      `INSERT INTO \`${tableName}\`
       (user_id, xp, level, messages, last_message)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, defaults.xp, defaults.level, defaults.messages, defaults.lastMessage]
    );
    return defaults;
  }

  const row = rows[0];
  return {
    xp: row.xp ?? 0,
    level: row.level ?? 0,
    messages: row.messages ?? 0,
    lastMessage: row.last_message ?? 0,
  };
}

export async function setUserData(guild, userId, userData) {
  const tableName = await ensureXpTable(guild);
  await pool.query(
    `INSERT INTO \`${tableName}\`
     (user_id, xp, level, messages, last_message)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       xp = VALUES(xp),
       level = VALUES(level),
       messages = VALUES(messages),
       last_message = VALUES(last_message)`,
    [
      userId,
      userData.xp ?? 0,
      userData.level ?? 0,
      userData.messages ?? 0,
      userData.lastMessage ?? 0,
    ]
  );
}

export async function getGuildUsers(guild) {
  const tableName = await ensureXpTable(guild);
  const [rows] = await pool.query(
    `SELECT user_id, xp, level, messages, last_message
     FROM \`${tableName}\``
  );
  return rows.map(row => ({
    userId: row.user_id,
    xp: row.xp ?? 0,
    level: row.level ?? 0,
    messages: row.messages ?? 0,
    lastMessage: row.last_message ?? 0,
  }));
}
