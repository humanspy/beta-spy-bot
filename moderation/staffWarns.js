import { pool } from "../database/mysql.js";
import { getGuildTableName } from "../database/tableNames.js";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function ensureStaffWarnTable(guild) {
  const tableName = getGuildTableName(guild, "staffwarns");
  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      warn_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      staff_id VARCHAR(32) NOT NULL,
      staff_tag VARCHAR(100) NULL,
      moderator_id VARCHAR(32) NOT NULL,
      moderator_tag VARCHAR(100) NULL,
      reason TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      expires_at BIGINT NOT NULL,
      KEY idx_staff_id (staff_id),
      KEY idx_expires_at (expires_at)
    )`
  );
  return tableName;
}

async function pruneExpiredStaffWarns(guild) {
  const tableName = await ensureStaffWarnTable(guild);
  await pool.query(
    `DELETE FROM \`${tableName}\`
     WHERE expires_at <= ?`,
    [Date.now()]
  );
}

export async function getActiveStaffWarns(guild, staffId) {
  await pruneExpiredStaffWarns(guild);
  const tableName = await ensureStaffWarnTable(guild);
  const [rows] = await pool.query(
    `SELECT warn_id, staff_id, staff_tag, moderator_id, moderator_tag,
            reason, created_at, expires_at
     FROM \`${tableName}\`
     WHERE staff_id = ?
     ORDER BY created_at ASC`,
    [staffId]
  );
  return rows;
}

export async function addStaffWarn(guild, warnData) {
  const tableName = await ensureStaffWarnTable(guild);
  const createdAt = Date.now();
  const expiresAt = createdAt + ONE_YEAR_MS;
  const [result] = await pool.query(
    `INSERT INTO \`${tableName}\`
     (staff_id, staff_tag, moderator_id, moderator_tag, reason, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      warnData.staffId,
      warnData.staffTag,
      warnData.moderatorId,
      warnData.moderatorTag,
      warnData.reason,
      createdAt,
      expiresAt,
    ]
  );
  return {
    warnId: result.insertId,
    createdAt,
    expiresAt,
  };
}

export async function removeStaffWarn(guild, warnId) {
  const tableName = await ensureStaffWarnTable(guild);
  const [result] = await pool.query(
    `DELETE FROM \`${tableName}\`
     WHERE warn_id = ?`,
    [warnId]
  );
  return result.affectedRows > 0;
}
