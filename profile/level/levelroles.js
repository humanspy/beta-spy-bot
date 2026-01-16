import { getStaffConfig, saveStaffConfig } from "../../moderation/staffConfig.js";

function getDefaultLevelRoles() {
  return {
    interval: 1,
    removePrevious: false,
    roles: {},
  };
}

export async function getLevelRoleConfig(guild) {
  const config = await getStaffConfig(guild);
  return config?.levelRoles ?? getDefaultLevelRoles();
}

export async function setLevelRoleConfig(guild, levelRoles) {
  const existing = (await getStaffConfig(guild)) ?? {
    guildId: guild.id,
    staffRoles: [],
    channels: {},
    levelRoles: getDefaultLevelRoles(),
    staffWarnConfig: {
      maxWarns: 3,
    },
    overrideCode: null,
  };
  existing.levelRoles = levelRoles;
  await saveStaffConfig(guild, existing);
}
