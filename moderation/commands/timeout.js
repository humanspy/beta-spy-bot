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
  if (sub === "add") {
    if (!hasPermission(interaction.member, "timeout")) {
      const role = getHighestStaffRole(interaction.member);
      return interaction.reply({
        content: `❌ Role **${role?.name ?? "Unknown"}** has no permission.`,
        ephemeral: true,
      });
    }

    const targetUser = interaction.options.getUser("user");
    const duration = parseDurationChoice(
      interaction.options.getString("duration")
    );
    const reason = interaction.options.getString("reason");

    const member = await interaction.guild.members.fetch(targetUser.id);
    await member.timeout(duration * 60 * 1000, reason);

    const caseNumber = await createCase(
      interaction.guild.id,
      "timeout",
      targetUser.id,
      targetUser.username,
      interaction.user.id,
      interaction.user.tag,
      reason,
      null,
      duration
    );

    return interaction.reply({
      content: `⏱️ **${targetUser.tag}** timed out for ${getDurationLabel(
        duration
      )} (Case #${caseNumber})`,
      ephemeral: true,
    });
  }

  if (sub === "remove") {
    const targetUser = interaction.options.getUser("user");
    const reason =
      interaction.options.getString("reason") || "Timeout removed";

    const member = await interaction.guild.members.fetch(targetUser.id);
    await member.timeout(null, reason);

    return interaction.reply({
      content: `✅ Timeout removed for **${targetUser.tag}**`,
      ephemeral: true,
    });
  }
}
