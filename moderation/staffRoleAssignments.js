import { pool } from "../database/mysql.js";

const TABLE_NAME = "staff_role_assignments";

function normalizeStaffRoleEntries(staffRoles) {
  return (staffRoles ?? [])
    .map(role => ({
      roleId: role.roleId ?? role,
      level: role.level ?? null,
    }))
    .filter(role => role.roleId);
}

async function ensureTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${TABLE_NAME}\` (
      guild_id VARCHAR(32) NOT NULL,
      staff_role_id VARCHAR(32) NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      role_level INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id, staff_role_id, user_id),
      KEY idx_guild_id (guild_id),
      KEY idx_role_id (staff_role_id),
      KEY idx_role_level (role_level),
      KEY idx_user_id (user_id)
    )`
  );
  const [columns] = await pool.query(`SHOW COLUMNS FROM \`${TABLE_NAME}\``);
  const columnNames = new Set(columns.map(col => col.Field));
  if (!columnNames.has("role_level")) {
    await pool.query(
      `ALTER TABLE \`${TABLE_NAME}\`
       ADD COLUMN role_level INT NOT NULL DEFAULT 0`
    );
  }
  return TABLE_NAME;
}

export async function syncMemberStaffRoleAssignments(member, staffRoles) {
  if (!member) return;
  await ensureTable();
  const staffRoleEntries = normalizeStaffRoleEntries(staffRoles);
  if (!staffRoleEntries.length) {
    await removeMemberStaffRoleAssignments(member.guild.id, member.id);
    return;
  }

  for (const { roleId, level } of staffRoleEntries) {
    if (member.roles.cache.has(roleId)) {
      await pool.query(
        `INSERT INTO \`${TABLE_NAME}\`
         (guild_id, staff_role_id, user_id, role_level)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           role_level = VALUES(role_level),
           updated_at = CURRENT_TIMESTAMP`,
        [member.guild.id, roleId, member.id, level ?? 0]
      );
    } else {
      await pool.query(
        `DELETE FROM \`${TABLE_NAME}\`
         WHERE guild_id = ? AND staff_role_id = ? AND user_id = ?`,
        [member.guild.id, roleId, member.id]
      );
    }
  }
}

export async function removeMemberStaffRoleAssignments(guildId, userId) {
  if (!guildId || !userId) return;
  await ensureTable();
  await pool.query(
    `DELETE FROM \`${TABLE_NAME}\` WHERE guild_id = ? AND user_id = ?`,
    [guildId, userId]
  );
}

export async function syncGuildStaffRoleAssignments(guild, staffRoles) {
  if (!guild) return;
  await ensureTable();
  const staffRoleEntries = normalizeStaffRoleEntries(staffRoles);

  await pool.query(`DELETE FROM \`${TABLE_NAME}\` WHERE guild_id = ?`, [
    guild.id,
  ]);

  if (!staffRoleEntries.length) return;

  const members = await guild.members.fetch();
  const rows = [];

  for (const member of members.values()) {
    for (const { roleId, level } of staffRoleEntries) {
      if (member.roles.cache.has(roleId)) {
        rows.push([guild.id, roleId, member.id, level ?? 0]);
      }
    }
  }

  if (!rows.length) return;

  const chunkSize = 1000;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await pool.query(
      `INSERT INTO \`${TABLE_NAME}\` (guild_id, staff_role_id, user_id, role_level)
       VALUES ?`,
      [chunk]
    );
  }
}

export async function syncAllStaffRoleAssignments(guildConfigs) {
  await ensureTable();
  await pool.query(`DELETE FROM \`${TABLE_NAME}\``);

  if (!guildConfigs?.length) return;

  const rows = [];
  for (const { guild, staffRoles } of guildConfigs) {
    if (!guild) continue;
    const staffRoleEntries = normalizeStaffRoleEntries(staffRoles);
    if (!staffRoleEntries.length) continue;
    const members = await guild.members.fetch();
    for (const member of members.values()) {
      for (const { roleId, level } of staffRoleEntries) {
        if (member.roles.cache.has(roleId)) {
          rows.push([guild.id, roleId, member.id, level ?? 0]);
        }
      }
    }
  }

  if (!rows.length) return;

  const chunkSize = 1000;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await pool.query(
      `INSERT INTO \`${TABLE_NAME}\` (guild_id, staff_role_id, user_id, role_level)
       VALUES ?`,
      [chunk]
    );
  }
}

export async function getStaffRoleAssignmentsSorted() {
  await ensureTable();
  const [rows] = await pool.query(
    `SELECT guild_id, staff_role_id, user_id, role_level, updated_at
     FROM \`${TABLE_NAME}\`
     ORDER BY guild_id ASC, staff_role_id ASC, role_level ASC, user_id ASC`
  );
  return rows;
}
