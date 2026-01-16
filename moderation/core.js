import { pool } from "../database/mysql.js";
import { EmbedBuilder } from "discord.js";
import { getStaffConfig } from "./staffConfig.js";

/* ===================== BOT OWNERS ===================== */

export const botOwners = {
  [process.env.DISCORD_BOT_OWNER_1]: true,
  [process.env.DISCORD_BOT_OWNER_2]: true,
};

function getCaseTableName(guildId) {
  const safeId = String(guildId);
  if (!/^\d+$/.test(safeId)) {
    throw new Error("Invalid guild id");
  }
  return `cases_${safeId}`;
}

export async function ensureCasesTable(guildId) {
  const tableName = getCaseTableName(guildId);
  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      case_number INT UNSIGNED NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      username VARCHAR(100) NULL,
      type VARCHAR(32) NOT NULL,
      moderator_id VARCHAR(32) NOT NULL,
      moderator_name VARCHAR(100) NOT NULL,
      reason TEXT NOT NULL,
      severity VARCHAR(32) NULL,
      duration VARCHAR(32) NULL,
      created_at BIGINT NOT NULL,
      PRIMARY KEY (case_number),
      KEY idx_user_id (user_id),
      KEY idx_type (type),
      KEY idx_created_at (created_at)
    )`
  );
  return tableName;
}

export function isBotOwner(memberOrUserId) {
  const id =
    typeof memberOrUserId === "string"
      ? memberOrUserId
      : memberOrUserId?.id;
  return Boolean(botOwners[id]);
}

export async function isBotOwnerBypass(member) {
  if (!member) return false;
  if (!isBotOwner(member)) return false;
  const role = await getHighestStaffRole(member);
  return !role;
}

/* ===================== PERMISSIONS ===================== */

export async function getHighestStaffRole(member) {
  if (!member) return null;

  const config = await getStaffConfig(member.guild.id);
  let best = null;

  for (const role of config?.staffRoles ?? []) {
    if (member.roles.cache.has(role.roleId)) {
      if (!best || role.level < best.level) best = role;
    }
  }

  return best;
}

export async function hasPermission(member, permission) {
  if (!member) return false;
  const role = await getHighestStaffRole(member);
  if (isBotOwner(member) && !role) return true;
  if (!role) return false;
  if (role.permissions === "all") return true;

  return role.permissions.includes(permission);
}

/* ===================== CASE NUMBER ===================== */

export async function getNextCaseNumber(guildId) {
  const tableName = await ensureCasesTable(guildId);
  const [[row]] = await pool.query(
    `SELECT MAX(case_number) AS max FROM \`${tableName}\``
  );

  return (row?.max ?? 0) + 1;
}

/* ===================== CREATE CASE ACTION ===================== */
/**
 * Used by: WARN, TIMEOUT, BAN, KICK
 */
export async function createCaseAction({
  guildId,
  userId,
  username,
  type,
  moderatorId,
  moderatorName,
  reason,
  severity,
  duration,
}) {
  const tableName = await ensureCasesTable(guildId);
  const safeReason = reason || "No reason provided";

  const finalSeverity =
    type === "WARN"
      ? severity || "minor"
      : null;

  const finalDuration =
    type === "TIMEOUT"
      ? duration || null
      : null;

  const caseNumber = await getNextCaseNumber(guildId);

  await pool.query(
    `INSERT INTO \`${tableName}\`
     (case_number, user_id, username, type,
      moderator_id, moderator_name,
      reason, severity, duration, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      caseNumber,
      userId,
      username,
      type,
      moderatorId,
      moderatorName,
      safeReason,
      finalSeverity,
      finalDuration,
      Date.now(),
    ]
  );

  return caseNumber;
}

/* ===================== CREATE REVERT ACTION ===================== */
/**
 * Used by: UNBAN, UNTIMEOUT, REVERT_WARN
 */
export async function createRevertAction({
  guildId,
  userId,
  type,
  moderatorId,
  moderatorName,
  reason,
}) {
  const tableName = await ensureCasesTable(guildId);
  await pool.query(
    `INSERT INTO \`${tableName}\`
     (case_number, user_id, type,
      moderator_id, moderator_name,
      reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      await getNextCaseNumber(guildId),
      userId,
      type,
      moderatorId,
      moderatorName,
      reason || "Reverted",
      Date.now(),
    ]
  );
}

/* ===================== CASE LOOKUP ===================== */

export async function loadCaseByNumber(guildId, caseNumber) {
  const tableName = await ensureCasesTable(guildId);
  const [[row]] = await pool.query(
    `SELECT *
     FROM \`${tableName}\`
     WHERE case_number = ?`,
    [caseNumber]
  );

  return row ?? null;
}

export async function loadCasesForUser(guildId, userId) {
  const tableName = await ensureCasesTable(guildId);
  const [rows] = await pool.query(
    `SELECT *
     FROM \`${tableName}\`
     WHERE user_id = ?
     ORDER BY type ASC, case_number ASC`,
    [userId]
  );

  return rows;
}

export async function loadCases(guildId) {
  const tableName = await ensureCasesTable(guildId);
  const [rows] = await pool.query(
    `SELECT *
     FROM \`${tableName}\`
     ORDER BY case_number ASC`
  );

  return {
    cases: rows.map(row => ({
      caseNumber: row.case_number,
      userId: row.user_id,
      username: row.username,
      type: row.type,
      reason: row.reason,
      createdAt: row.created_at,
    })),
  };
}

/* ===================== CASE DELETE ===================== */

export async function deleteCase(guildId, caseNumber) {
  const tableName = await ensureCasesTable(guildId);
  const [res] = await pool.query(
    `DELETE FROM \`${tableName}\`
     WHERE case_number = ?`,
    [caseNumber]
  );

  return res.affectedRows > 0;
}

/* ===================== MOD LOGS ===================== */

export async function logModerationAction({
  guild,
  actor,
  actorMember,
  action,
  target,
  reason,
  caseNumber,
  fields = [],
  color = 0x2f3136,
}) {
  if (!guild || !actor) return;
  if (isBotOwner(actor)) {
    const staffRole = actorMember
      ? await getHighestStaffRole(actorMember)
      : null;
    if (!staffRole) return;
  }

  const config = await getStaffConfig(guild.id);
  const channelId = config?.channels?.modLogs;
  if (!channelId) return;

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(action)
    .setTimestamp()
    .setFields(
      [
        { name: "Moderator", value: `<@${actor.id}>`, inline: true },
        target ? { name: "Target", value: target, inline: true } : null,
        caseNumber ? { name: "Case", value: `#${caseNumber}`, inline: true } : null,
        reason ? { name: "Reason", value: reason } : null,
        ...fields,
      ].filter(Boolean)
    );

  await channel.send({ embeds: [embed] });
}

/* ===================== DM HANDLER ===================== */

export const DM_EXCEPTIONS = new Set([
  "case",
  "purge",
  "help",
  "generatebancode",
]);

export async function dmAffectedUser({
  actor,
  actorMember,
  commandName,
  targetUser,
  guildName,
  message,
}) {
  if (!targetUser) return;
  if (isBotOwner(actor)) {
    const staffRole = actorMember
      ? await getHighestStaffRole(actorMember)
      : null;
    if (!staffRole) return;
  }
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
    // user DMs closed
  }
}
