import { pool } from "../../database/mysql.js";

function getDefaultLevelRoles() {
  return {
    interval: 1,
    removePrevious: false,
    roles: {},
  };
}

async function ensureLevelRolesTable() {
  const tableName = "level_roles_config";
  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      guild_id VARCHAR(32) NOT NULL PRIMARY KEY,
      interval_value INT NOT NULL DEFAULT 1,
      remove_previous TINYINT(1) NOT NULL DEFAULT 0,
      roles_json JSON NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
    )`
  );
  return tableName;
}

export async function getLevelRoleConfig(guild) {
  const tableName = await ensureLevelRolesTable();
  const guildId = typeof guild === "object" ? guild?.id : guild;
  const [[row]] = await pool.query(
    `SELECT interval_value, remove_previous, roles_json
     FROM \`${tableName}\`
     WHERE guild_id = ?`,
    [guildId]
  );

  if (!row) return getDefaultLevelRoles();

  const roles =
    typeof row.roles_json === "string"
      ? JSON.parse(row.roles_json)
      : row.roles_json;

  return {
    interval: row.interval_value ?? 1,
    removePrevious: Boolean(row.remove_previous),
    roles: roles ?? {},
  };
}

export async function setLevelRoleConfig(guild, levelRoles) {
  const tableName = await ensureLevelRolesTable();
  const guildId = typeof guild === "object" ? guild?.id : guild;
  const rolesJson = JSON.stringify(levelRoles.roles ?? {});
  await pool.query(
    `INSERT INTO \`${tableName}\`
     (guild_id, interval_value, remove_previous, roles_json)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       interval_value = VALUES(interval_value),
       remove_previous = VALUES(remove_previous),
       roles_json = VALUES(roles_json)`,
    [
      guildId,
      levelRoles.interval ?? 1,
      levelRoles.removePrevious ? 1 : 0,
      rolesJson,
    ]
  );
}
