import { pool } from "../database/mysql.js";

const TABLE_NAME = "staff_promotion_config";

export async function ensurePromotionTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${TABLE_NAME}\` (
      guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
      entry_roles_json JSON NULL,
      max_role_id VARCHAR(32) NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );
}

export async function getPromotionConfig(guildId) {
  await ensurePromotionTable();
  const [rows] = await pool.query(
    `SELECT * FROM \`${TABLE_NAME}\` WHERE guild_id = ?`,
    [guildId]
  );
  if (!rows.length) return null;
  
  let entryRoles = [];
  try {
    entryRoles = typeof rows[0].entry_roles_json === 'string' 
      ? JSON.parse(rows[0].entry_roles_json) 
      : rows[0].entry_roles_json;
  } catch {}

  return {
    guildId: rows[0].guild_id,
    entryRoles: Array.isArray(entryRoles) ? entryRoles : [],
    maxRoleId: rows[0].max_role_id,
  };
}

export async function savePromotionConfig(guildId, config) {
  await ensurePromotionTable();
  await pool.query(
    `INSERT INTO \`${TABLE_NAME}\` (guild_id, entry_roles_json, max_role_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
     entry_roles_json = VALUES(entry_roles_json),
     max_role_id = VALUES(max_role_id)`,
    [guildId, JSON.stringify(config.entryRoles), config.maxRoleId]
  );
}