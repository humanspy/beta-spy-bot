import { pool } from "../database/mysql.js";
import { EmbedBuilder } from "discord.js";
import { getStaffConfig } from "./staffConfig.js";

/* ===================== BOT OWNERS ===================== */

export const botOwners = {
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

  return best;
}

export function hasPermission(member, permission) {
  if (!member) return false;
  if (isBotOwner(member)) return true;

  const role = getHighestStaffRole(member);
  if (!role) return false;
  if (role.permissions === "all") return true;

  return role.permissions.includes(permission);
}

/* ===================== CASE NUMBER ===================== */

export async function getNextCaseNumber(guildId) {
  const [[row]] = await pool.query(
    "SELECT MAX(case_number) AS max FROM actions WHERE guild_id = ?",
    [guildId]
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
    `INSERT INTO actions
     (guild_id, case_number, user_id, username, type,
      moderator_id, moderator_name,
      reason, severity, duration, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      guildId,
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
  await pool.query(
    `INSERT INTO actions
     (guild_id, case_number, user_id, type,
      moderator_id, moderator_name,
      reason, created_at)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
    [
      guildId,
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
  const [[row]] = await pool.query(
    `SELECT *
     FROM actions
     WHERE guild_id = ? AND case_number = ?`,
    [guildId, caseNumber]
  );

  return row ?? null;
}

export async function loadCasesForUser(guildId, userId) {
  const [rows] = await pool.query(
    `SELECT *
     FROM actions
     WHERE guild_id = ?
       AND user_id = ?
       AND case_number IS NOT NULL
     ORDER BY case_number ASC`,
    [guildId, userId]
  );

  return rows;
}

/* ===================== CASE DELETE ===================== */

export async function deleteCase(guildId, caseNumber) {
  const [res] = await pool.query(
    `DELETE FROM actions
     WHERE guild_id = ? AND case_number = ?`,
    [guildId, caseNumber]
  );

  return res.affectedRows > 0;
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
    // user DMs closed
  }
}
