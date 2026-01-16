import { pool } from "../database/mysql.js";
import { extractGuildId, getGuildTableName } from "../database/tableNames.js";

const staffConfigCache = new Map();
let cacheInitialized = false;

function getDefaultLevelRoles() {
  return {
    interval: 1,
    removePrevious: false,
    roles: {},
  };
}

function getDefaultStaffWarnConfig() {
  return {
    maxWarns: 3,
  };
}

async function ensureTable(guild) {
  const tableName = getGuildTableName(guild, "staffconfig");
  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      staff_roles_json JSON NOT NULL,
      channels_json JSON NOT NULL,
      level_roles_json JSON NULL,
      staffwarn_config_json JSON NULL,
      override_code VARCHAR(64) NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
    )`
  );
  const [columns] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
  const columnNames = new Set(columns.map(col => col.Field));
  if (!columnNames.has("level_roles_json")) {
    await pool.query(
      `ALTER TABLE \`${tableName}\`
       ADD COLUMN level_roles_json JSON NULL`
    );
  }
  if (!columnNames.has("staffwarn_config_json")) {
    await pool.query(
      `ALTER TABLE \`${tableName}\`
       ADD COLUMN staffwarn_config_json JSON NULL`
    );
  }
  if (!columnNames.has("override_code")) {
    await pool.query(
      `ALTER TABLE \`${tableName}\`
       ADD COLUMN override_code VARCHAR(64) NULL`
    );
  }
  return tableName;
}

export async function getStaffConfig(guild) {
  const guildId = typeof guild === "object" ? guild?.id : guild;
  const cached = staffConfigCache.get(String(guildId));
  if (cached) return cached;

  const tableName = await ensureTable(guild);
  const [rows] = await pool.query(
    `SELECT staff_roles_json, channels_json, level_roles_json,
            staffwarn_config_json, override_code
     FROM \`${tableName}\`
     WHERE id = 1`
  );
  if (!rows.length) return null;

  const row = rows[0];
  const staffRoles =
    typeof row.staff_roles_json === "string"
    ? JSON.parse(row.staff_roles_json)
    : row.staff_roles_json;
  const channels =
    typeof row.channels_json === "string"
    ? JSON.parse(row.channels_json)
    : row.channels_json;
  const levelRoles =
    row.level_roles_json
      ? typeof row.level_roles_json === "string"
        ? JSON.parse(row.level_roles_json)
        : row.level_roles_json
      : getDefaultLevelRoles();
  const staffWarnConfig =
    row.staffwarn_config_json
      ? typeof row.staffwarn_config_json === "string"
        ? JSON.parse(row.staffwarn_config_json)
        : row.staffwarn_config_json
      : getDefaultStaffWarnConfig();

  const config = {
    guildId,
    staffRoles,
    channels,
    levelRoles,
    staffWarnConfig,
    overrideCode: row.override_code ?? null,
  };
  staffConfigCache.set(String(guildId), config);
  return config;
}

export async function saveStaffConfig(guild, config) {
  const tableName = await ensureTable(guild);
  const staffRolesJson = JSON.stringify(config.staffRoles ?? []);
  const channelsJson = JSON.stringify(config.channels ?? {});
  const levelRolesJson = JSON.stringify(
    config.levelRoles ?? getDefaultLevelRoles()
  );
  const staffWarnConfigJson = JSON.stringify(
    config.staffWarnConfig ?? getDefaultStaffWarnConfig()
  );

  await pool.query(
    `INSERT INTO \`${tableName}\`
     (id, staff_roles_json, channels_json, level_roles_json,
      staffwarn_config_json, override_code)
     VALUES (1, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       staff_roles_json = VALUES(staff_roles_json),
       channels_json = VALUES(channels_json),
       level_roles_json = VALUES(level_roles_json),
       staffwarn_config_json = VALUES(staffwarn_config_json),
       override_code = VALUES(override_code)`,
    [
      staffRolesJson,
      channelsJson,
      levelRolesJson,
      staffWarnConfigJson,
      config.overrideCode ?? null,
    ]
  );
  const guildId = typeof guild === "object" ? guild?.id : guild;
  staffConfigCache.set(String(guildId), {
    ...config,
    guildId,
  });
}

export async function deleteStaffConfig(guild) {
  const tableName = getGuildTableName(guild, "staffconfig");
  await pool.query(`DROP TABLE IF EXISTS \`${tableName}\``);
  const guildId = typeof guild === "object" ? guild?.id : guild;
  staffConfigCache.delete(String(guildId));
}

export async function initStaffConfigCache() {
  if (cacheInitialized) return;
  const [rows] = await pool.query("SHOW TABLES LIKE '%\\_staffconfig'");
  const tables = rows.map(row => Object.values(row)[0]).filter(Boolean);

  await Promise.all(
    tables.map(async tableName => {
      const guildId = extractGuildId(tableName, "staffconfig");
      if (!guildId) return;
      const [configRows] = await pool.query(
        `SELECT staff_roles_json, channels_json, level_roles_json,
                staffwarn_config_json, override_code
         FROM \`${tableName}\`
         WHERE id = 1`
      );
      if (!configRows.length) return;
      const row = configRows[0];
      const staffRoles =
        typeof row.staff_roles_json === "string"
        ? JSON.parse(row.staff_roles_json)
        : row.staff_roles_json;
      const channels =
        typeof row.channels_json === "string"
        ? JSON.parse(row.channels_json)
        : row.channels_json;
      const levelRoles =
        row.level_roles_json
          ? typeof row.level_roles_json === "string"
            ? JSON.parse(row.level_roles_json)
            : row.level_roles_json
          : getDefaultLevelRoles();
      const staffWarnConfig =
        row.staffwarn_config_json
          ? typeof row.staffwarn_config_json === "string"
            ? JSON.parse(row.staffwarn_config_json)
            : row.staffwarn_config_json
          : getDefaultStaffWarnConfig();
      staffConfigCache.set(guildId, {
        guildId,
        staffRoles,
        channels,
        levelRoles,
        staffWarnConfig,
        overrideCode: row.override_code ?? null,
      });
    })
  );

  cacheInitialized = true;
}
