import { pool } from "../database/mysql.js";

const staffConfigCache = new Map();
let cacheInitialized = false;

function getTableName(guildId) {
  const safeId = String(guildId);
  if (!/^\d+$/.test(safeId)) {
    throw new Error("Invalid guild id");
  }
  return `staff_config_${safeId}`;
}

async function ensureTable(guildId) {
  const tableName = getTableName(guildId);
  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      staff_roles_json JSON NOT NULL,
      channels_json JSON NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
    )`
  );
  return tableName;
}

export async function getStaffConfig(guildId) {
  const cached = staffConfigCache.get(String(guildId));
  if (cached) return cached;

  const tableName = await ensureTable(guildId);
  const [rows] = await pool.query(
    `SELECT staff_roles_json, channels_json
     FROM \`${tableName}\`
     WHERE id = 1`
  );
  if (!rows.length) return null;

  const row = rows[0];
  const staffRoles = typeof row.staff_roles_json === "string"
    ? JSON.parse(row.staff_roles_json)
    : row.staff_roles_json;
  const channels = typeof row.channels_json === "string"
    ? JSON.parse(row.channels_json)
    : row.channels_json;

  const config = { guildId, staffRoles, channels };
  staffConfigCache.set(String(guildId), config);
  return config;
}

export async function saveStaffConfig(guildId, config) {
  const tableName = await ensureTable(guildId);
  const staffRolesJson = JSON.stringify(config.staffRoles ?? []);
  const channelsJson = JSON.stringify(config.channels ?? {});

  await pool.query(
    `INSERT INTO \`${tableName}\` (id, staff_roles_json, channels_json)
     VALUES (1, ?, ?)
     ON DUPLICATE KEY UPDATE
       staff_roles_json = VALUES(staff_roles_json),
       channels_json = VALUES(channels_json)`,
    [staffRolesJson, channelsJson]
  );
  staffConfigCache.set(String(guildId), config);
}

export async function deleteStaffConfig(guildId) {
  const tableName = getTableName(guildId);
  await pool.query(`DROP TABLE IF EXISTS \`${tableName}\``);
  staffConfigCache.delete(String(guildId));
}

export async function initStaffConfigCache() {
  if (cacheInitialized) return;
  const [rows] = await pool.query("SHOW TABLES LIKE 'staff_config_%'");
  const tables = rows.map(row => Object.values(row)[0]).filter(Boolean);

  await Promise.all(
    tables.map(async tableName => {
      const guildId = tableName.replace("staff_config_", "");
      if (!/^\d+$/.test(guildId)) return;
      const [configRows] = await pool.query(
        `SELECT staff_roles_json, channels_json
         FROM \`${tableName}\`
         WHERE id = 1`
      );
      if (!configRows.length) return;
      const row = configRows[0];
      const staffRoles = typeof row.staff_roles_json === "string"
        ? JSON.parse(row.staff_roles_json)
        : row.staff_roles_json;
      const channels = typeof row.channels_json === "string"
        ? JSON.parse(row.channels_json)
        : row.channels_json;
      staffConfigCache.set(guildId, {
        guildId,
        staffRoles,
        channels,
      });
    })
  );

  cacheInitialized = true;
}
