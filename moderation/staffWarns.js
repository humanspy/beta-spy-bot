import { pool } from "../database/mysql.js";
import {
  getGuildTableName,
  getLegacyGuildTableName,
} from "../database/tableNames.js";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function tableExists(tableName) {
  const [rows] = await pool.query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

async function ensureStaffWarnTable(guild) {
  const tableName = getGuildTableName(guild, "staffwarns");
  const legacyTableName = getLegacyGuildTableName(guild, "staffwarns");
  const legacyExists = await tableExists(legacyTableName);
  const tableExistsNow = await tableExists(tableName);
  if (legacyExists && !tableExistsNow) {
    await pool.query(
      `RENAME TABLE \`${legacyTableName}\` TO \`${tableName}\``
    );
    return tableName;
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      warn_id INT UNSIGNED NOT NULL PRIMARY KEY,
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
  if (legacyExists) {
    await pool.query(
      `INSERT IGNORE INTO \`${tableName}\` SELECT * FROM \`${legacyTableName}\``
    );
    await pool.query(`DROP TABLE \`${legacyTableName}\``);
  }
  const [columns] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
  const warnIdColumn = columns.find(col => col.Field === "warn_id");
  if (warnIdColumn?.Extra?.includes("auto_increment")) {
    await pool.query(
      `ALTER TABLE \`${tableName}\`
       MODIFY warn_id INT UNSIGNED NOT NULL PRIMARY KEY`
    );
  }
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
  const [[row]] = await pool.query(
    `SELECT warn_id
     FROM \`${tableName}\`
     ORDER BY warn_id DESC
     LIMIT 1`
  );
  const nextWarnId = (row?.warn_id ?? 0) + 1;
  const createdAt = Date.now();
  const expiresAt = createdAt + ONE_YEAR_MS;
  await pool.query(
    `INSERT INTO \`${tableName}\`
     (warn_id, staff_id, staff_tag, moderator_id, moderator_tag, reason, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nextWarnId,
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
    warnId: nextWarnId,
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
  if (!result.affectedRows) return false;

  return true;
}
