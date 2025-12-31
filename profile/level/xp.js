import { getLevelRoleConfig } from "./levelroles.js";
import { loadUserXP, saveUserXP } from "./storage.js";

export function addXP(guildId, userId) {
  const data = loadUserXP(guildId, userId);

  data.xp += 10;

  const needed = data.level * 100;
  let leveledUp = false;

  if (data.xp >= needed) {
    data.level++;
    data.xp = 0;
    leveledUp = true;
  }

  saveUserXP(guildId, userId, data);

  return {
    leveledUp,
    level: data.level,
  };
}

export async function applyLevelRoles(member, level) {
  const config = getLevelRoleConfig(member.guild.id);

  if (level % config.interval !== 0) return;

  const roleId = config.roles[level];
  if (!roleId) return;

  const role = member.guild.roles.cache.get(roleId);
  if (!role) return;

  await member.roles.add(role).catch(() => {});

  if (config.removePrevious) {
    for (const [lvl, rid] of Object.entries(config.roles)) {
      if (Number(lvl) < level) {
        const oldRole = member.guild.roles.cache.get(rid);
        if (oldRole) {
          await member.roles.remove(oldRole).catch(() => {});
        }
      }
    }
  }
}

