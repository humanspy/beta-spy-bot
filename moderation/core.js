/* ===================== IMPORTS ===================== */

import fs from "fs/promises";
import path from "path";
import { getStaffConfig } from "./staffConfig.js";
import { organizeCasesToFolder } from "./organize-cases.js";

/* ===================== STORAGE ===================== */

const DATA_DIR = "./data/moderation";
const CASES_FILE = path.join(DATA_DIR, "cases.json");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadAllCases() {
  try {
    await ensureDir();
    const raw = await fs.readFile(CASES_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveAllCases(all) {
  await ensureDir();
  await fs.writeFile(CASES_FILE, JSON.stringify(all, null, 2));
}

/* ===================== CASE SYSTEM ===================== */

async function loadCases(guildId) {
  const all = await loadAllCases();

  if (!all[guildId]) {
    all[guildId] = { nextCaseNumber: 1, cases: [] };
    await saveAllCases(all);
  }

  return all[guildId];
}

async function saveCases(guildId, data) {
  const all = await loadAllCases();
  all[guildId] = data;
  await saveAllCases(all);

  try {
    await organizeCasesToFolder(all);
  } catch {}
}

export async function createCase(
  guildId,
  type,
  userId,
  username,
  moderatorId,
  moderatorName,
  reason,
  severity = null,
  duration = null
) {
  const data = await loadCases(guildId);
  const caseNumber = data.nextCaseNumber++;

  data.cases.push({
    caseNumber,
    type,
    userId,
    username,
    moderatorId,
    moderatorName,
    reason,
    severity,
    duration,
    timestamp: Date.now(),
    guildId,
  });

  await saveCases(guildId, data);
  return caseNumber;
}

/* ===================== WARNINGS ===================== */

export async function addWarning({
  guildId,
  userId,
  username,
  moderatorId,
  moderatorName,
  reason,
  severity = "moderate",
}) {
  return createCase(
    guildId,
    "WARN",
    userId,
    username,
    moderatorId,
    moderatorName,
    reason,
    severity
  );
}
/**
 * Load all warning cases for a guild
 */
export async function loadWarnings(guildId) {
  const data = await loadCases(guildId);
  return data.cases.filter(c => c.type === "WARN");
}
/**
 * Save warning cases for a guild (case-based system)
 */
export async function saveWarnings(guildId, warnings) {
  const data = await loadCases(guildId);

  // Remove existing WARN cases
  data.cases = data.cases.filter(c => c.type !== "WARN");

  // Re-add updated warnings
  for (const warn of warnings) {
    data.cases.push(warn);
  }

  await saveCases(guildId, data);
}


/* ===================== BOT OWNER ===================== */

const userOverrides = {
  [process.env.DISCORD_Bot_Owner]: {
    name: "Bot Owner",
    level: -1,
    permissions: "all",
  },
  [process.env.DISCORD_Bot_CO-Owner]: {
    name: "Co Owner",
    level: -1,
    permissions: "all",
  },
};

/* ===================== STAFF HELPERS ===================== */

function isUserOverridden(userId) {
  return !!userOverrides[userId];
}

export function getHighestStaffRole(member) {
  if (!member) return null;

  const config = getStaffConfig(member.guild.id);
  let best = null;

  if (config?.staffRoles) {
    for (const role of config.staffRoles) {
      if (member.roles.cache.has(role.roleId)) {
        if (!best || role.level < best.level) best = role;
      }
    }
  }

  if (best) return best;

  const override = userOverrides[member.id];
  if (override) {
    return {
      id: "override",
      name: override.name,
      level: override.level,
      permissions: override.permissions,
    };
  }

  return null;
}

export function isModerator(member) {
  if (!member) return false;
  const config = getStaffConfig(member.guild.id);
  if (!config?.staffRoles) return false;

  return (
    member.roles.cache.some(r =>
      config.staffRoles.some(sr => sr.roleId === r.id)
    ) || isUserOverridden(member.id)
  );
}

export function hasPermission(member, permission) {
  if (!member) return false;

  const override = userOverrides[member.id];
  if (override) {
    if (override.permissions === "all") return true;
    if (override.permissions.includes(permission)) return true;
  }

  const role = getHighestStaffRole(member);
  if (!role) return false;

  if (role.permissions === "all") return true;
  if (role.permissions.includes(permission)) return true;

  return false;
}

/* ===================== CHANNEL HELPERS ===================== */

export function getOverrideChannel(guildId) {
  return getStaffConfig(guildId)?.channels?.overrideCodes ?? null;
}

function getLogChannel(guildId) {
  return getStaffConfig(guildId)?.channels?.modLogs ?? null;
}

/* ===================== LOGGING ===================== */

export async function sendLog(guild, embed, actorId) {
  const channelId = getLogChannel(guild.id);
  if (!channelId) return;
  if (isUserOverridden(actorId)) return;

  try {
    const channel = await guild.channels.fetch(channelId);
    if (channel) await channel.send({ embeds: [embed] });
  } catch {}
}

/**
 * Validate and consume a ban override code
 */
export async function validateAndUseOverrideCode(code, userId) {
  const data = await loadOverrideCodes();

  const entry = data.codes.find(
    c => c.code === code && c.used !== true
  );

  if (!entry) return null;

  entry.used = true;
  entry.usedBy = userId;
  entry.usedAt = Date.now();

  await saveOverrideCodes(data);
  return entry;
}


/* ===================== WEBSITE PERMISSIONS ===================== */

export function hasWebPermission(guildId, userId, permission) {
  const config = getStaffConfig(guildId);
  if (!config?.staffRoles) return false;

  const override = userOverrides[userId];
  if (override) {
    if (override.permissions === "all") return true;
    if (override.permissions.includes(permission)) return true;
  }

  for (const role of config.staffRoles) {
    if (role.users?.includes(userId)) {
      if (role.permissions === "all") return true;
      if (role.permissions.includes(permission)) return true;
    }
  }

  return false;
}




