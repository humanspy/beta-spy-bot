import { pool } from "../database/mysql.js";

const TABLE_NAME = "promo_count";

async function ensurePromoCountTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${TABLE_NAME}\` (
      guild_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      promo_count INT UNSIGNED NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id, user_id),
      KEY idx_user_id (user_id)
    )`
  );
  return TABLE_NAME;
}

export async function getPromoCount(guild, userId) {
  const guildId = typeof guild === "object" ? guild?.id : guild;
  const tableName = await ensurePromoCountTable();
  const [rows] = await pool.query(
    `SELECT promo_count
     FROM \`${tableName}\`
     WHERE guild_id = ? AND user_id = ?`,
    [guildId, userId]
  );
  if (!rows.length) return 0;
  return Number(rows[0].promo_count ?? 0);
}

export async function setPromoCount(guild, userId, promoCount) {
  const guildId = typeof guild === "object" ? guild?.id : guild;
  const tableName = await ensurePromoCountTable();
  const safeCount = Math.max(Number(promoCount ?? 0), 0);
  if (safeCount === 0) {
    await pool.query(
      `DELETE FROM \`${tableName}\`
       WHERE guild_id = ? AND user_id = ?`,
      [guildId, userId]
    );
    return;
  }
  await pool.query(
    `INSERT INTO \`${tableName}\`
     (guild_id, user_id, promo_count)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       promo_count = VALUES(promo_count)`,
    [guildId, userId, safeCount]
  );
}
