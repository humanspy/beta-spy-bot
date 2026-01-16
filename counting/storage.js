import { pool } from "../database/mysql.js";
import { getGuildTableName } from "../database/tableNames.js";

async function ensureCountingTable(guild) {
  const tableName = getGuildTableName(guild, "counting");
  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      setup_completed TINYINT(1) NOT NULL DEFAULT 0,
      channel_id VARCHAR(32) NULL,
      current INT NOT NULL DEFAULT 0,
      last_user_id VARCHAR(32) NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
    )`
  );
  return tableName;
}

export async function getCountingData(guild) {
  const tableName = await ensureCountingTable(guild);
  const [rows] = await pool.query(
    `SELECT setup_completed, channel_id, current, last_user_id
     FROM \`${tableName}\`
     WHERE id = 1`
  );

  if (!rows.length) {
    await pool.query(
      `INSERT INTO \`${tableName}\`
       (id, setup_completed, channel_id, current, last_user_id)
       VALUES (1, 0, NULL, 0, NULL)`
    );
    return {
      setupCompleted: false,
      channelId: null,
      current: 0,
      lastUserId: null,
    };
  }

  const row = rows[0];
  return {
    setupCompleted: Boolean(row.setup_completed),
    channelId: row.channel_id,
    current: row.current ?? 0,
    lastUserId: row.last_user_id ?? null,
  };
}

export async function enableCounting(guild, channelId) {
  const tableName = await ensureCountingTable(guild);
  await pool.query(
    `INSERT INTO \`${tableName}\`
     (id, setup_completed, channel_id, current, last_user_id)
     VALUES (1, 1, ?, 0, NULL)
     ON DUPLICATE KEY UPDATE
       setup_completed = VALUES(setup_completed),
       channel_id = VALUES(channel_id),
       current = VALUES(current),
       last_user_id = VALUES(last_user_id)`,
    [channelId]
  );
}

export async function updateCountingData(guild, newData) {
  const tableName = await ensureCountingTable(guild);
  await pool.query(
    `INSERT INTO \`${tableName}\`
     (id, setup_completed, channel_id, current, last_user_id)
     VALUES (1, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       setup_completed = VALUES(setup_completed),
       channel_id = VALUES(channel_id),
       current = VALUES(current),
       last_user_id = VALUES(last_user_id)`,
    [
      newData.setupCompleted ? 1 : 0,
      newData.channelId,
      newData.current ?? 0,
      newData.lastUserId ?? null,
    ]
  );
}
