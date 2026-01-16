import { getLevelRoleConfig } from "./levelroles.js";
import { getUserData, setUserData } from "./storage.js";

export async function addXP(guild, userId) {
  const data = await getUserData(guild, userId);

  data.xp += 10;
  data.messages += 1;
  data.lastMessage = Date.now();

  const needed = Math.max(100, data.level * 100);
  let leveledUp = false;

  if (data.xp >= needed) {
    data.level++;
    data.xp = 0;
    leveledUp = true;
  }

  await setUserData(guild, userId, data);

  return {
    leveledUp,
    level: data.level,
  };
}

export async function applyLevelRoles(member, level) {
  const config = await getLevelRoleConfig(member.guild);

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

