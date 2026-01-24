import { pool } from "../database/mysql.js";

export const purgeGuildData = async guildId => {
  try {
    const [[dbRow]] = await pool.query("SELECT DATABASE() AS db");
    const dbName = dbRow?.db;
    if (!dbName) return;

    try {
      await pool.query("DELETE FROM `invites` WHERE guild_id = ?", [guildId]);
    } catch (err) {
      console.error("❌ Failed to purge invites table:", err);
    }

    try {
      await pool.query("DELETE FROM `announcements` WHERE guild_id = ?", [
        guildId,
      ]);
    } catch (err) {
      console.error("❌ Failed to purge announcements table:", err);
    }

    const [guildIdTables] = await pool.query(
      `SELECT DISTINCT TABLE_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND COLUMN_NAME = 'guild_id'`,
      [dbName]
    );

    for (const { TABLE_NAME: tableName } of guildIdTables) {
      if (!/^[A-Za-z0-9_]+$/.test(tableName)) continue;
      try {
        await pool.query(`DELETE FROM \`${tableName}\` WHERE guild_id = ?`, [
          guildId,
        ]);
      } catch (err) {
        console.error(`❌ Failed to purge guild data in ${tableName}:`, err);
      }
    }

    const [dynamicTables] = await pool.query(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME LIKE ?`,
      [dbName, `%${guildId}%`]
    );

    for (const { TABLE_NAME: tableName } of dynamicTables) {
      if (!/^[A-Za-z0-9_]+$/.test(tableName)) continue;
      try {
        await pool.query(`DROP TABLE \`${tableName}\``);
      } catch (err) {
        console.error(`❌ Failed to drop table ${tableName}:`, err);
      }
    }
  } catch (err) {
    console.error("❌ Guild data purge failed:", err);
  }
};
