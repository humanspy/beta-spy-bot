import { pool } from "../../database/mysql.js";
import {
  getGuildTableName,
  getLegacyGuildTableName,
} from "../../database/tableNames.js";

async function tableExists(tableName) {
  const [rows] = await pool.query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

async function ensureXpColumns(tableName) {
  const [columns] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
  const columnNames = new Set(columns.map(column => column.Field));
  if (!columnNames.has("username")) {
    await pool.query(
      `ALTER TABLE \`${tableName}\`
       ADD COLUMN username VARCHAR(100) NULL AFTER user_id`
    );
  }
  if (!columnNames.has("nickname")) {
    await pool.query(
      `ALTER TABLE \`${tableName}\`
       ADD COLUMN nickname VARCHAR(100) NULL AFTER username`
    );
  }
  if (!columnNames.has("nickname_locked")) {
    await pool.query(
      `ALTER TABLE \`${tableName}\`
       ADD COLUMN nickname_locked TINYINT(1) NOT NULL DEFAULT 0 AFTER nickname`
    );
  }
}

async function ensureXpTable(guild) {
  const tableName = getGuildTableName(guild, "xp");
  const legacyTableName = getLegacyGuildTableName(guild, "xp");
  const legacyExists = await tableExists(legacyTableName);
  const tableExistsNow = await tableExists(tableName);
  if (legacyExists && !tableExistsNow) {
    await pool.query(
      `RENAME TABLE \`${legacyTableName}\` TO \`${tableName}\``
    );
    await ensureXpColumns(tableName);
    return tableName;
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      user_id VARCHAR(32) NOT NULL PRIMARY KEY,
      username VARCHAR(100) NULL,
      nickname VARCHAR(100) NULL,
      nickname_locked TINYINT(1) NOT NULL DEFAULT 0,
      xp INT NOT NULL DEFAULT 0,
      level INT NOT NULL DEFAULT 0,
      messages INT NOT NULL DEFAULT 0,
      last_message BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
    )`
  );
  if (legacyExists) {
    await pool.query(
    `INSERT IGNORE INTO \`${tableName}\`
       (user_id, xp, level, messages, last_message, updated_at)
       SELECT user_id, xp, level, messages, last_message, updated_at
       FROM \`${legacyTableName}\``
    );
    await pool.query(`DROP TABLE \`${legacyTableName}\``);
  }
  await ensureXpColumns(tableName);
  return tableName;
}

export async function getUserData(guild, userId) {
  const tableName = await ensureXpTable(guild);
  const [rows] = await pool.query(
    `SELECT username, nickname, nickname_locked, xp, level, messages, last_message
     FROM \`${tableName}\`
     WHERE user_id = ?`,
    [userId]
  );

  if (!rows.length) {
    const defaults = {
      username: null,
      nickname: null,
      nicknameLocked: false,
      xp: 0,
      level: 0,
      messages: 0,
      lastMessage: 0,
    };
    await pool.query(
      `INSERT INTO \`${tableName}\`
       (user_id, username, nickname, nickname_locked, xp, level, messages, last_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        defaults.username,
        defaults.nickname,
        defaults.nicknameLocked ? 1 : 0,
        defaults.xp,
        defaults.level,
        defaults.messages,
        defaults.lastMessage,
      ]
    );
    return defaults;
  }

  const row = rows[0];
  return {
    username: row.username ?? null,
    nickname: row.nickname ?? null,
    nicknameLocked: Boolean(row.nickname_locked),
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
     (user_id, username, nickname, nickname_locked, xp, level, messages, last_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       username = VALUES(username),
       nickname = VALUES(nickname),
       nickname_locked = VALUES(nickname_locked),
       xp = VALUES(xp),
       level = VALUES(level),
       messages = VALUES(messages),
       last_message = VALUES(last_message)`,
    [
      userId,
      userData.username ?? null,
      userData.nickname ?? null,
      userData.nicknameLocked ? 1 : 0,
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
    `SELECT user_id, username, nickname, nickname_locked, xp, level, messages, last_message
     FROM \`${tableName}\``
  );
  return rows.map(row => ({
    userId: row.user_id,
    username: row.username ?? null,
    nickname: row.nickname ?? null,
    nicknameLocked: Boolean(row.nickname_locked),
    xp: row.xp ?? 0,
    level: row.level ?? 0,
    messages: row.messages ?? 0,
    lastMessage: row.last_message ?? 0,
  }));
}
