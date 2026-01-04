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

/* ===================== SETUP MESSAGE HANDLER ===================== */

/**
 * Fetch a single message from the setup command author
 * Used only for interactive setup flows
 *
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @param {number} timeoutMs
 * @returns {Promise<import("discord.js").Message|null>}
 */
export async function fetchSetupMessage(
  interaction,
  timeoutMs = 5 * 60 * 1000
) {
  try {
    const channel = interaction.channel;
    if (!channel) return null;

    const collected = await channel.awaitMessages({
      max: 1,
      time: timeoutMs,
      filter: m =>
        m.author.id === interaction.user.id &&
        !m.author.bot,
    });

    const msg = collected.first();
    if (!msg) return null;

    // Clean up setup input
    await msg.delete().catch(() => {});

    return msg;
  } catch {
    return null;
  }
}

/* ===================== CASE HELPERS ===================== */

export async function getNextCaseNumber(guildId) {
  const [rows] = await pool.query(
    "SELECT MAX(case_number) AS max FROM cases WHERE guild_id = ?",
    [guildId]
  );
  return (rows[0]?.max ?? 0) + 1;
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
  const caseNumber = await getNextCaseNumber(guildId);

  await pool.query(
    `INSERT INTO cases
     (guild_id, case_number, type, user_id, username, moderator_id, moderator_name, reason, severity, duration, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      guildId,
      caseNumber,
      type,
      userId,
      username,
      moderatorId,
      moderatorName,
      reason,
      severity,
      duration,
      Date.now(),
    ]
  );

  return caseNumber;
}

export async function loadCases(guildId) {
  const [rows] = await pool.query(
    "SELECT * FROM cases WHERE guild_id = ? ORDER BY case_number ASC",
    [guildId]
  );
  return rows;
}

export async function deleteCase(guildId, caseNumber) {
  const [res] = await pool.query(
    "DELETE FROM cases WHERE guild_id = ? AND case_number = ?",
    [guildId, caseNumber]
  );
  return res.affectedRows > 0;
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
  const [rows] = await pool.query(
    "SELECT * FROM cases WHERE guild_id = ? AND type = 'WARN'",
    [guildId]
  );
  return rows;
}

export async function revertWarning(guildId, userId) {
  const [rows] = await pool.query(
    `SELECT id FROM cases
     WHERE guild_id = ? AND user_id = ? AND type = 'WARN'
     ORDER BY case_number DESC LIMIT 1`,
    [guildId, userId]
  );

  if (!rows.length) return false;

  await pool.query("DELETE FROM cases WHERE id = ?", [rows[0].id]);
  return true;
}

/* ===================== OVERRIDE CODES ===================== */

export async function generateBanOverrideCode(createdBy, creatorId) {
  const code = Math.random().toString(36).slice(2, 10).toUpperCase();

  await pool.query(
    `INSERT INTO override_codes
     (code, created_by, creator_id, created_at)
     VALUES (?, ?, ?, ?)`,
    [code, createdBy, creatorId, Date.now()]
  );

  return code;
}

export async function validateAndUseOverrideCode(code, userId) {
  const [rows] = await pool.query(
    "SELECT * FROM override_codes WHERE code = ? AND used = FALSE",
    [code]
  );

  if (!rows.length) return null;

  await pool.query(
    `UPDATE override_codes
     SET used = TRUE, used_by = ?, used_at = ?
     WHERE code = ?`,
    [userId, Date.now(), code]
  );

  return rows[0];
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
  if (!member) return false;
  if (isBotOwner(member)) return true;

  const role = getHighestStaffRole(member);
  if (!role) return false;
  if (role.permissions === "all") return true;

  return role.permissions.includes(permission);
}

/* ===================== WEB PERMISSIONS ===================== */

export function hasWebPermission(guildId, userId, permission) {
  if (isBotOwner(userId)) return true;

  const config = getStaffConfig(guildId);
  if (!config?.staffRoles) return false;

  let best = null;

  for (const role of config.staffRoles) {
    if (role.users?.includes(userId)) {
      if (!best || role.level < best.level) best = role;
    }
  }

  if (!best) return false;
  if (best.permissions === "all") return true;

  return best.permissions.includes(permission);
}

/* ===================== LOGGING ===================== */

export async function sendLog(guild, embed, actor) {
  if (isBotOwner(actor)) return;

  const channelId = getStaffConfig(guild.id)?.channels?.modLogs;
  if (!channelId) return;

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (channel) await channel.send({ embeds: [embed] });
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

  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle("📢 Moderation Action")
    .setDescription(message)
    .addFields(
      { name: "Server", value: guildName, inline: true },
      { name: "Action", value: commandName.toUpperCase(), inline: true }
    )
    .setTimestamp();

  await targetUser.send({ embeds: [embed] }).catch(() => {});
}
