import { pool } from "../database/mysql.js";
import { getGuildTableName } from "../database/tableNames.js";

async function ensureRolesTable(guild) {
  const tableName = getGuildTableName(guild, "roles");
  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      role_id VARCHAR(32) NOT NULL,
      role_name VARCHAR(100) NOT NULL,
      role_level INT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (role_id),
      KEY idx_role_level (role_level),
      KEY idx_role_name (role_name)
    )`
  );
  return tableName;
}

function buildRoleEntries(guild) {
  const sortedRoles = [...guild.roles.cache.values()].sort(
    (a, b) => b.position - a.position
  );
  return sortedRoles.map((role, index) => ({
      roleId: role.id,
      roleName: role.name,
      level: index + 1,
    }));
}

export async function syncGuildRoles(guild) {
  if (!guild) return;
  const tableName = await ensureRolesTable(guild);
  const roleEntries = buildRoleEntries(guild);

  await pool.query(`DELETE FROM \`${tableName}\``);
  if (!roleEntries.length) return;

  const rows = roleEntries.map(entry => [
    entry.roleId,
    entry.roleName,
    entry.level,
  ]);
  const chunkSize = 1000;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await pool.query(
      `INSERT INTO \`${tableName}\` (role_id, role_name, role_level)
       VALUES ?`,
      [chunk]
    );
  }
}
