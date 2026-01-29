import { pool } from "../database/mysql.js";
import { getPromotionConfig } from "./promotionConfig.js";
import { getSortedStaffRoles, promoteStaffMember } from "./utils.js";
import { pruneExpiredStaffWarns, getRecentGuildWarns } from "./staffWarns.js";

export async function runAutoPromotions(guild) {
  await pruneExpiredStaffWarns(guild);
  
  const config = await getPromotionConfig(guild.id);
  const sortedRoles = await getSortedStaffRoles(guild);
  if (!sortedRoles.length) return { promoted: [], errors: [] };

  const members = await guild.members.fetch();
  const promoted = [];
  const errors = [];

  // Get all staff warns for the last 2 months
  // 2 months approx = 60 days
  const recentWarnStaffIds = await getRecentGuildWarns(guild, 60 * 24 * 60 * 60 * 1000);
  const warnedUserIds = new Set(recentWarnStaffIds);

  // Get last promotion times
  const [assignments] = await pool.query(
    `SELECT user_id, updated_at FROM staff_role_assignments WHERE guild_id = ?`,
    [guild.id]
  );
  const lastUpdates = new Map(assignments.map(a => [a.user_id, new Date(a.updated_at)]));

  for (const member of members.values()) {
    // Skip if warned recently
    if (warnedUserIds.has(member.id)) continue;

    // Find current highest role
    const currentRole = [...sortedRoles].reverse().find(r => member.roles.cache.has(r.roleId));
    if (!currentRole) continue; // Not staff

    // Check tenure (2 months = approx 60 days)
    const lastUpdate = lastUpdates.get(member.id);
    if (lastUpdate && (Date.now() - lastUpdate.getTime()) < 60 * 24 * 60 * 60 * 1000) {
      continue; // Not enough tenure
    }

    // Find next role
    const currentIndex = sortedRoles.findIndex(r => r.roleId === currentRole.roleId);
    const nextRole = sortedRoles[currentIndex + 1];

    if (!nextRole) continue; // Max level

    // Check max auto-promo cap
    if (config?.maxRoleId) {
        const maxRoleIndex = sortedRoles.findIndex(r => r.roleId === config.maxRoleId);
        if (maxRoleIndex !== -1 && currentIndex >= maxRoleIndex) continue;
    }

    try {
      await promoteStaffMember(guild, member, nextRole, "Auto Promotion (Good Behavior)");
      promoted.push(member.user.tag);
    } catch (err) {
      errors.push({ user: member.user.tag, error: err.message });
    }
  }

  return { promoted, errors };
}