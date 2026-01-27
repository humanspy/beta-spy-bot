import { pool } from "../database/mysql.js";

const TABLE_NAME = "promo_config";

async function ensurePromoConfigTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${TABLE_NAME}\` (
      guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
      highest_role_id VARCHAR(32) NULL,
      first_promotion_roles INT UNSIGNED NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
    )`
  );
  const [columns] = await pool.query(`SHOW COLUMNS FROM \`${TABLE_NAME}\``);
  const columnNames = new Set(columns.map(col => col.Field));
  if (!columnNames.has("highest_role_id")) {
    await pool.query(
      `ALTER TABLE \`${TABLE_NAME}\`
       ADD COLUMN highest_role_id VARCHAR(32) NULL`
    );
  }
  if (!columnNames.has("first_promotion_roles")) {
    await pool.query(
      `ALTER TABLE \`${TABLE_NAME}\`
       ADD COLUMN first_promotion_roles INT UNSIGNED NOT NULL DEFAULT 1`
    );
  }
  return TABLE_NAME;
}

export async function getPromoConfig(guild) {
  const guildId = typeof guild === "object" ? guild?.id : guild;
  const tableName = await ensurePromoConfigTable();
  const [rows] = await pool.query(
    `SELECT guild_id, highest_role_id, first_promotion_roles
     FROM \`${tableName}\`
     WHERE guild_id = ?`,
    [guildId]
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    guildId: row.guild_id,
    highestRoleId: row.highest_role_id ?? null,
    firstPromotionRoles: Number(row.first_promotion_roles ?? 1),
  };
}

export async function savePromoConfig(guild, config) {
  const guildId = typeof guild === "object" ? guild?.id : guild;
  const tableName = await ensurePromoConfigTable();
  await pool.query(
    `INSERT INTO \`${tableName}\`
     (guild_id, highest_role_id, first_promotion_roles)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       highest_role_id = VALUES(highest_role_id),
       first_promotion_roles = VALUES(first_promotion_roles)`,
    [
      guildId,
      config.highestRoleId ?? null,
      config.firstPromotionRoles ?? 1,
    ]
  );
}
