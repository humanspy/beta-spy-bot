import {
  hasPermission,
  getHighestStaffRole,
  createCase,
} from "../core.js";
import {
  parseDurationChoice,
  getDurationLabel,
} from "../utils/duration.js";

export default async function timeout(interaction, sub) {
  /* ===================== ADD TIMEOUT ===================== */
  if (sub === "add") {
    if (!hasPermission(interaction.member, "timeout")) {
      const role = getHighestStaffRole(interaction.member);
      return interaction.reply({
        content: `❌ Role **${role?.name ?? "Unknown"}** has no permission.`,
        flags: 64,
      });
    }

    const targetUser = interaction.options.getUser("user");
    const durationChoice = interaction.options.getString("duration");
    const reason =
      interaction.options.getString("reason") || "No reason provided";

    const durationMinutes = parseDurationChoice(durationChoice);
    if (!durationMinutes || durationMinutes <= 0) {
      return interaction.reply({
        content: "❌ Invalid duration.",
        flags: 64,
      });
    }

    const member = await interaction.guild.members.fetch(targetUser.id);
    await member.timeout(durationMinutes * 60 * 1000, reason);

    const caseNumber = await createCase(
      interaction.guild.id,
      "TIMEOUT",
      targetUser.id,
      targetUser.username,
      interaction.user.id,
      interaction.user.tag,
      reason,
      null,
      durationMinutes
    );

    return interaction.reply({
      content:
        `⏱️ **${targetUser.tag}** timed out for ` +
        `**${getDurationLabel(durationMinutes)}** (Case #${caseNumber})`,
      flags: 64,
    });
  }

  /* ===================== REMOVE TIMEOUT ===================== */
  if (sub === "remove") {
    if (!hasPermission(interaction.member, "timeout")) {
      const role = getHighestStaffRole(interaction.member);
      return interaction.reply({
        content: `❌ Role **${role?.name ?? "Unknown"}** has no permission.`,
        flags: 64,
      });
    }

    const targetUser = interaction.options.getUser("user");
    const reason =
      interaction.options.getString("reason") || "Timeout removed";

    const member = await interaction.guild.members.fetch(targetUser.id);
    await member.timeout(null, reason);

    return interaction.reply({
      content: `✅ Timeout removed for **${targetUser.tag}**`,
      flags: 64,
    });
  }
}

