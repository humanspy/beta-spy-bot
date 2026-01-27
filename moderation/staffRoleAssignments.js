import { pool } from "../database/mysql.js";

const TABLE_NAME = "staff_role_assignments";
const memberSyncSuppressions = new Map();
const MEMBER_SYNC_SUPPRESS_MS = 15 * 1000;

export function suppressMemberStaffRoleSync(memberId) {
  if (!memberId) return;
  memberSyncSuppressions.set(memberId, Date.now() + MEMBER_SYNC_SUPPRESS_MS);
}

export function isMemberStaffRoleSyncSuppressed(memberId) {
  if (!memberId) return false;
  const expiresAt = memberSyncSuppressions.get(memberId);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    memberSyncSuppressions.delete(memberId);
    return false;
  }
  return true;
}

function normalizeStaffRoleEntries(staffRoles) {
  return (staffRoles ?? [])
    .map(role => ({
      roleId: role.roleId ?? role,
      roleName: role.roleName ?? role.name ?? null,
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
      role_name VARCHAR(100) NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id, staff_role_id, user_id),
      KEY idx_guild_id (guild_id),
      KEY idx_role_id (staff_role_id),
      KEY idx_role_level (role_level),
      KEY idx_role_name (role_name),
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
  if (!columnNames.has("role_name")) {
    await pool.query(
      `ALTER TABLE \`${TABLE_NAME}\`
       ADD COLUMN role_name VARCHAR(100) NULL`
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

  for (const { roleId, roleName, level } of staffRoleEntries) {
    if (member.roles.cache.has(roleId)) {
      const resolvedRoleName =
        roleName ?? member.guild.roles.cache.get(roleId)?.name ?? null;
      await pool.query(
        `INSERT INTO \`${TABLE_NAME}\`
         (guild_id, staff_role_id, user_id, role_level, role_name)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           role_level = VALUES(role_level),
           role_name = VALUES(role_name),
           updated_at = CURRENT_TIMESTAMP`,
        [member.guild.id, roleId, member.id, level ?? 0, resolvedRoleName]
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
    for (const { roleId, roleName, level } of staffRoleEntries) {
      const resolvedRoleName =
        roleName ?? guild.roles.cache.get(roleId)?.name ?? null;
      if (member.roles.cache.has(roleId)) {
        rows.push([guild.id, roleId, member.id, level ?? 0, resolvedRoleName]);
      }
    }
  }

  if (!rows.length) return;

  const chunkSize = 1000;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await pool.query(
      `INSERT INTO \`${TABLE_NAME}\` (guild_id, staff_role_id, user_id, role_level, role_name)
       VALUES ?`,
      [chunk]
    );
  }
}

export async function syncAllStaffRoleAssignments(
  guildConfigs,
  { clearExisting = false } = {}
) {
  await ensureTable();
  if (clearExisting) {
    await pool.query(`DELETE FROM \`${TABLE_NAME}\``);
  }

  if (!guildConfigs?.length) return;

  const rows = [];
  for (const { guild, staffRoles } of guildConfigs) {
    if (!guild) continue;
    const staffRoleEntries = normalizeStaffRoleEntries(staffRoles);
    if (!staffRoleEntries.length) continue;
    const members = await guild.members.fetch();
    for (const member of members.values()) {
      for (const { roleId, roleName, level } of staffRoleEntries) {
        const resolvedRoleName =
          roleName ?? guild.roles.cache.get(roleId)?.name ?? null;
        if (member.roles.cache.has(roleId)) {
          rows.push([guild.id, roleId, member.id, level ?? 0, resolvedRoleName]);
        }
      }
    }
  }

  if (!rows.length) return;

  const chunkSize = 1000;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await pool.query(
      `INSERT INTO \`${TABLE_NAME}\` (guild_id, staff_role_id, user_id, role_level, role_name)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         role_level = VALUES(role_level),
         role_name = VALUES(role_name),
         updated_at = CURRENT_TIMESTAMP`,
      [chunk]
    );
  }
}

export async function syncStaffRoleAssignmentsFromDatabase(guildConfigs) {
  await ensureTable();

  if (!guildConfigs?.length) return;

  for (const { guild, staffRoles } of guildConfigs) {
    if (!guild) continue;
    const staffRoleEntries = normalizeStaffRoleEntries(staffRoles);
    if (!staffRoleEntries.length) continue;

    const staffRoleIds = staffRoleEntries
      .map(role => role.roleId)
      .filter(Boolean);
    const staffRoleIdSet = new Set(staffRoleIds);

    const [rows] = await pool.query(
      `SELECT staff_role_id, user_id
       FROM \`${TABLE_NAME}\`
       WHERE guild_id = ?`,
      [guild.id]
    );

    const desiredRolesByUser = new Map();
    for (const row of rows) {
      if (!staffRoleIdSet.has(row.staff_role_id)) continue;
      if (!desiredRolesByUser.has(row.user_id)) {
        desiredRolesByUser.set(row.user_id, new Set());
      }
      desiredRolesByUser.get(row.user_id).add(row.staff_role_id);
    }

    const members = await guild.members.fetch();
    for (const member of members.values()) {
      const desiredRoles = desiredRolesByUser.get(member.id) ?? new Set();
      const rolesToAdd = [];
      const rolesToRemove = [];

      for (const roleId of staffRoleIds) {
        if (!guild.roles.cache.has(roleId)) continue;
        const hasRole = member.roles.cache.has(roleId);
        const shouldHaveRole = desiredRoles.has(roleId);
        if (shouldHaveRole && !hasRole) {
          rolesToAdd.push(roleId);
        } else if (!shouldHaveRole && hasRole) {
          rolesToRemove.push(roleId);
        }
      }

      if (rolesToAdd.length) {
        try {
          suppressMemberStaffRoleSync(member.id);
          await member.roles.add(rolesToAdd);
        } catch (err) {
          console.error(
            `❌ Failed to add staff roles for ${member.user?.tag ?? member.id}:`,
            err
          );
        }
      }

      if (rolesToRemove.length) {
        try {
          suppressMemberStaffRoleSync(member.id);
          await member.roles.remove(rolesToRemove);
        } catch (err) {
          console.error(
            `❌ Failed to remove staff roles for ${member.user?.tag ?? member.id}:`,
            err
          );
        }
      }
    }
  }
}

export async function getStaffRoleAssignmentsSorted() {
  await ensureTable();
  const [rows] = await pool.query(
    `SELECT guild_id, staff_role_id, user_id, role_level, role_name, updated_at
     FROM \`${TABLE_NAME}\`
     ORDER BY guild_id ASC, staff_role_id ASC, role_level ASC, role_name ASC, user_id ASC`
  );
  return rows;
}
