/* ===================== IMPORTS ===================== */

import fs from "fs/promises";
import { getStaffConfig } from "./staffConfig.js";
import { organizeCasesToFolder } from "./organize-cases.js";
import fs from "fs";
import path from "path";

/* ===================== STORAGE ===================== */

const DATA_DIR = "./data/moderation";
const CASES_FILE = path.join(DATA_DIR, "cases.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadCases() {
  ensureDir();
  if (!fs.existsSync(CASES_FILE)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(CASES_FILE, "utf8"));
}

function saveCases(data) {
  ensureDir();
  fs.writeFileSync(CASES_FILE, JSON.stringify(data, null, 2));
}

/* ===================== WARNINGS ===================== */

/**
 * Adds a warning case for a user
 */
export function addWarning({
  guildId,
  userId,
  username,
  moderatorId,
  moderatorName,
  reason,
  severity = "moderate",
}) {
  const allCases = loadCases();

  if (!allCases[guildId]) {
    allCases[guildId] = {
      nextCaseNumber: 1,
      cases: [],
    };
  }

  const guildData = allCases[guildId];
  const caseNumber = guildData.nextCaseNumber++;

  guildData.cases.push({
    caseNumber,
    type: "WARN",
    userId,
    username,
    moderatorId,
    moderatorName,
    reason,
    severity,
    timestamp: Date.now(),
  });

  saveCases(allCases);

  // Keep case folders organized
  try {
    organizeCasesToFolder(allCases);
  } catch {}

  return caseNumber;
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

function getHighestStaffRole(member) {
  if (!member) return null;

  const config = getStaffConfig(member.guild.id);
  let best = null;

  if (config?.staffRoles) {
    for (const role of config.staffRoles) {
      if (member.roles.cache.has(role.roleId)) {
        if (!best || role.level < best.level) {
          best = role;
        }
      }
    }
  }

  if (best) return best;

  const override = userOverrides[member.id];
  if (override) {
    return {
      id: "override",
      name: override.name,
      level: override.level ?? -1,
      permissions: override.permissions,
    };
  }

  return null;
}

function isModerator(member) {
  if (!member) return false;

  const config = getStaffConfig(member.guild.id);
  if (!config?.staffRoles) return false;

  return (
    member.roles.cache.some(r =>
      config.staffRoles.some(sr => sr.roleId === r.id)
    ) || isUserOverridden(member.id)
  );
}

function hasPermission(member, permission) {
  if (!member) return false;

  const override = userOverrides[member.id];
  if (override) {
    if (override.permissions === "all") return true;
    if (Array.isArray(override.permissions) && override.permissions.includes(permission)) {
      return true;
    }
  }

  const role = getHighestStaffRole(member);
  if (!role) return false;

  if (role.permissions === "all") return true;
  if (Array.isArray(role.permissions) && role.permissions.includes(permission)) {
    return true;
  }

  return false;
}

/* ===================== CHANNEL HELPERS ===================== */

function getOverrideChannel(guildId) {
  return getStaffConfig(guildId)?.channels?.overrideCodes ?? null;
}

function getLogChannel(guildId) {
  return getStaffConfig(guildId)?.channels?.modLogs ?? null;
}

/* ===================== JSON HELPERS ===================== */

async function loadJSON(path, fallback) {
  try {
    return JSON.parse(await fs.readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function saveJSON(path, data) {
  await fs.writeFile(path, JSON.stringify(data, null, 2));
}

/* ===================== CASE SYSTEM ===================== */

async function loadAllCases() {
  return loadJSON("./cases.json", {});
}

async function saveAllCases(all) {
  await saveJSON("./cases.json", all);
}

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

async function createCase(
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

/* ===================== OVERRIDE CODES ===================== */

async function loadOverrideCodes() {
  return loadJSON("./override-codes.json", { codes: [] });
}

async function saveOverrideCodes(data) {
  await saveJSON("./override-codes.json", data);
}

function generateRandomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ123456789!§$%&";
  return Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

async function generateBanOverrideCode(tag, userId) {
  const data = await loadOverrideCodes();
  let code;

  do {
    code = generateRandomCode();
  } while (data.codes.some(c => c.code === code));

  data.codes.push({
    code,
    generatedBy: tag,
    generatedById: userId,
    generatedAt: Date.now(),
    used: false,
  });

  await saveOverrideCodes(data);
  return code;
}

async function validateAndUseOverrideCode(code, userId) {
  const data = await loadOverrideCodes();
  const entry = data.codes.find(c => c.code === code && !c.used);
  if (!entry) return null;

  entry.used = true;
  entry.usedBy = userId;
  entry.usedAt = Date.now();
  await saveOverrideCodes(data);
  return entry;
}

/* ===================== LOGGING ===================== */

async function sendLog(guild, embed, actorId) {
  const channelId = getLogChannel(guild.id);
  if (!channelId) return;
  if (isUserOverridden(actorId)) return;

  try {
    const channel = await guild.channels.fetch(channelId);
    if (channel) await channel.send({ embeds: [embed] });
  } catch {}
}

/* ===================== Website ===================== */


function hasWebPermission(guildId, userId, permission) {
  const config = getStaffConfig(guildId);
  if (!config?.staffRoles) return false;

  // Bot owner override
  const override = userOverrides[userId];
  if (override) {
    if (override.permissions === "all") return true;
    if (override.permissions.includes(permission)) return true;
  }

  // Role-based permissions (stored during setup)
  for (const role of config.staffRoles) {
    if (role.users?.includes(userId)) {
      if (role.permissions === "all") return true;
      if (role.permissions.includes(permission)) return true;
    }
  }

  return false;
}



/* ===================== EXPORTS ===================== */

export {
  hasPermission,
  isModerator,
  getHighestStaffRole,
  createCase,
  generateBanOverrideCode,
  validateAndUseOverrideCode,
  sendLog,
  getOverrideChannel,
  hasWebPermission
};


