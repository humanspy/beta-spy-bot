import fs from "fs/promises";
import path from "path";
import { getStaffConfig } from "./staffConfig.js";
import { organizeCasesToFolder } from "./organize-cases.js";

/* ===================== PATHS ===================== */

const DATA_DIR = "./data/moderation";
const CASES_FILE = path.join(DATA_DIR, "cases.json");
const OVERRIDE_FILE = path.join(DATA_DIR, "overrideCodes.json");

/* ===================== HELPERS ===================== */

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadJSON(file, fallback) {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function saveJSON(file, data) {
  await ensureDir();
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

/* ===================== CASES ===================== */

export async function loadCases(guildId) {
  const all = await loadJSON(CASES_FILE, {});
  if (!all[guildId]) {
    all[guildId] = { nextCaseNumber: 1, cases: [] };
    await saveJSON(CASES_FILE, all);
  }
  return all[guildId];
}

async function saveCases(guildId, data) {
  const all = await loadJSON(CASES_FILE, {});
  all[guildId] = data;
  await saveJSON(CASES_FILE, all);
  await organizeCasesToFolder(all).catch(() => {});
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

export async function deleteCase(guildId, caseNumber) {
  const data = await loadCases(guildId);
  const before = data.cases.length;
  data.cases = data.cases.filter(c => c.caseNumber !== caseNumber);
  if (before === data.cases.length) return false;
  await saveCases(guildId, data);
  return true;
}

/* ===================== WARNINGS ===================== */

export async function addWarning(
  guildId,
  userId,
  username,
  moderatorId,
  moderatorName,
  reason,
  severity = "moderate"
) {
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

export async function loadWarnings(guildId) {
  const data = await loadCases(guildId);
  return data.cases.filter(c => c.type === "WARN");
}

export async function saveWarnings(guildId, warnings) {
  const data = await loadCases(guildId);
  data.cases = data.cases.filter(c => c.type !== "WARN");
  data.cases.push(...warnings);
  await saveCases(guildId, data);
}

/* ===================== OVERRIDE CODES ===================== */

async function loadOverrideCodes() {
  return loadJSON(OVERRIDE_FILE, { codes: [] });
}

async function saveOverrideCodes(data) {
  await saveJSON(OVERRIDE_FILE, data);
}

export async function generateBanOverrideCode(createdBy, creatorId) {
  const data = await loadOverrideCodes();
  const code = Math.random().toString(36).slice(2, 10).toUpperCase();

  data.codes.push({
    code,
    createdBy,
    creatorId,
    createdAt: Date.now(),
    used: false,
  });

  await saveOverrideCodes(data);
  return code;
}

export async function validateAndUseOverrideCode(code, userId) {
  const data = await loadOverrideCodes();
  const entry = data.codes.find(c => c.code === code && !c.used);
  if (!entry) return null;

  entry.used = true;
  entry.usedBy = userId;
  entry.usedAt = Date.now();

  await saveOverrideCodes(data);
  return entry;
}

/* ===================== PERMISSIONS ===================== */

const userOverrides = {
  [process.env.DISCORD_Bot_Owner]: {
    name: "Bot Owner",
    level: -1,
    permissions: "all",
  },
  [process.env.DISCORD_Bot_CO_OWNER]: {
    name: "Co Owner",
    level: -1,
    permissions: "all",
  },
};

export function getHighestStaffRole(member) {
  if (!member) return null;
  const config = getStaffConfig(member.guild.id);
  let best = null;

  for (const role of config?.staffRoles ?? []) {
    if (member.roles.cache.has(role.roleId)) {
      if (!best || role.level < best.level) best = role;
    }
  }

  return best ?? userOverrides[member.id] ?? null;
}

export function hasPermission(member, permission) {
  const override = userOverrides[member?.id];
  if (override?.permissions === "all") return true;

  const role = getHighestStaffRole(member);
  if (!role) return false;
  if (role.permissions === "all") return true;
  return role.permissions.includes(permission);
}

/* ===================== LOGGING ===================== */

export function getOverrideChannel(guildId) {
  return getStaffConfig(guildId)?.channels?.overrideCodes ?? null;
}

export async function sendLog(guild, embed) {
  const channelId = getStaffConfig(guild.id)?.channels?.modLogs;
  if (!channelId) return;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (channel) await channel.send({ embeds: [embed] });
}

/* ===================== WEB PERMISSIONS ===================== */

/**
 * Web-safe permission check
 * Uses userId instead of Discord GuildMember
 */
export function hasWebPermission(guildId, userId, permission) {
  // Bot owner override
  const override = userOverrides[userId];
  if (override?.permissions === "all") return true;

  const config = getStaffConfig(guildId);
  if (!config?.staffRoles) return false;

  let bestRole = null;

  for (const role of config.staffRoles) {
    if (role.users?.includes(userId)) {
      if (!bestRole || role.level < bestRole.level) {
        bestRole = role;
      }
    }
  }

  if (!bestRole) return false;
  if (bestRole.permissions === "all") return true;

  return bestRole.permissions.includes(permission);
}


