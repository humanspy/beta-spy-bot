import fs from "fs/promises";
import path from "path";
import { EmbedBuilder } from "discord.js";
import { getStaffConfig } from "./staffConfig.js";
import { organizeCasesToFolder } from "./organize-cases.js";

/* ===================== PATHS ===================== */

const DATA_DIR = "./data/moderation";
const CASES_FILE = path.join(DATA_DIR, "cases.json");
const OVERRIDE_FILE = path.join(DATA_DIR, "overrideCodes.json");

/* ===================== BOT OWNERS ===================== */

const botOwners = {
  [process.env.DISCORD_BOT_OWNER_1]: true,
  [process.env.DISCORD_BOT_OWNER_2]: true,
};

export function isBotOwner(memberOrUserId) {
  const id =
    typeof memberOrUserId === "string"
      ? memberOrUserId
      : memberOrUserId?.id;

  return Boolean(botOwners[id]);
}

/* ===================== SAFE HELPERS ===================== */

async function safe(fn, fallback = null) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

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

/* ===================== CASE STORAGE ===================== */

export async function loadCases(guildId) {
  return safe(async () => {
    const all = await loadJSON(CASES_FILE, {});
    if (!all[guildId]) {
      all[guildId] = { nextCaseNumber: 1, cases: [] };
      await saveJSON(CASES_FILE, all);
    }
    return all[guildId];
  }, { nextCaseNumber: 1, cases: [] });
}

async function saveCases(guildId, data) {
  await safe(async () => {
    const all = await loadJSON(CASES_FILE, {});
    all[guildId] = data;
    await saveJSON(CASES_FILE, all);
    await organizeCasesToFolder(all);
  });
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

export async function revertWarning(guildId, targetUserId) {
  const data = await loadCases(guildId);

  const index = [...data.cases]
    .reverse()
    .findIndex(c => c.type === "WARN" && c.userId === targetUserId);

  if (index === -1) return false;

  const realIndex = data.cases.length - 1 - index;
  data.cases.splice(realIndex, 1);
  await saveCases(guildId, data);
  return true;
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

export function getHighestStaffRole(member) {
  if (!member) return null;
  const config = getStaffConfig(member.guild.id);
  let best = null;

  for (const role of config?.staffRoles ?? []) {
    if (member.roles.cache.has(role.roleId)) {
      if (!best || role.level < best.level) best = role;
    }
  }

  return best ?? null;
}

export function hasPermission(member, permission) {
  try {
    if (!member) return false;
    if (isBotOwner(member)) return true;

    const role = getHighestStaffRole(member);
    if (!role) return false;
    if (role.permissions === "all") return true;

    return role.permissions.includes(permission);
  } catch {
    return false;
  }
}

/* ===================== WEB PERMISSIONS ===================== */

export function hasWebPermission(guildId, userId, permission) {
  try {
    if (isBotOwner(userId)) return true;

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
  } catch {
    return false;
  }
}

/* ===================== LOGGING ===================== */

export async function sendLog(guild, embed, actor) {
  if (isBotOwner(actor)) return;

  try {
    const channelId = getStaffConfig(guild.id)?.channels?.modLogs;
    if (!channelId) return;

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (channel) await channel.send({ embeds: [embed] });
  } catch {
    // silent by design
  }
}

/* ===================== DM HANDLER (EMBEDS) ===================== */

const DM_EXCEPTIONS = new Set([
  "case",
  "purge",
  "help",
  "generatebancode",
]);

export async function dmAffectedUser({
  actor,
  commandName,
  targetUser,
  guildName,
  message,
}) {
  if (!targetUser) return;
  if (isBotOwner(actor)) return;
  if (DM_EXCEPTIONS.has(commandName)) return;

  try {
    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle("📢 Moderation Action")
      .setDescription(message)
      .addFields(
        { name: "Server", value: guildName, inline: true },
        { name: "Action", value: commandName.toUpperCase(), inline: true }
      )
      .setTimestamp();

    await targetUser.send({ embeds: [embed] });
  } catch {
    // DM blocked or closed — ignored
  }
}
