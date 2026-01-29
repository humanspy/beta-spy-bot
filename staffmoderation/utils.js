import { pool } from "../database/mysql.js";
import { getStaffConfig } from "../moderation/staffConfig.js";

export async function getSortedStaffRoles(guild) {
  const config = await getStaffConfig(guild);
  if (!config || !config.staffRoles) return [];
  return config.staffRoles.sort((a, b) => a.level - b.level);
}

export async function demoteStaffMember(guild, member, reason = "Demotion") {
  const sortedRoles = await getSortedStaffRoles(guild);
  // Sort descending to find highest role first
  const descRoles = [...sortedRoles].reverse();
  
  for (const roleDef of descRoles) {
    if (member.roles.cache.has(roleDef.roleId)) {
      await member.roles.remove(roleDef.roleId, reason).catch(() => {});
      return { roleId: roleDef.roleId, roleName: member.guild.roles.cache.get(roleDef.roleId)?.name };
    }
  }
  return null;
}

export async function promoteStaffMember(guild, member, nextRole, reason = "Promotion") {
    await member.roles.add(nextRole.roleId, reason).catch(() => {});
    return nextRole;
}