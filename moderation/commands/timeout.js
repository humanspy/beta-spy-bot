import { hasPermission, dmAffectedUser } from "../core.js";
import { parseDuration } from "../utils/duration.js";

export default async function timeout(interaction, sub) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!hasPermission(interaction.member, "timeout")) {
      return interaction.editReply("❌ You do not have permission to timeout users.");
    }

    const member = interaction.options.getMember("user");
    if (!member) {
      return interaction.editReply("❌ User not found.");
    }

    if (sub === "add") {
      const durationRaw = interaction.options.getString("duration");
      const reason = interaction.options.getString("reason");

      const durationMs = parseDuration(durationRaw);
      if (!durationMs) {
        return interaction.editReply("❌ Invalid duration.");
      }

      await member.timeout(durationMs, reason);

      await dmAffectedUser({
        actor: interaction.user,
        commandName: "timeout",
        targetUser: member.user,
        guildName: interaction.guild.name,
        message: `You have been timed out.\n\nDuration: ${durationRaw}\nReason: ${reason}`,
      });

      return interaction.editReply(`⏱️ **${member.user.tag}** timed out.`);
    }

    if (sub === "remove") {
      await member.timeout(null);

      await dmAffectedUser({
        actor: interaction.user,
        commandName: "timeout",
        targetUser: member.user,
        guildName: interaction.guild.name,
        message: "Your timeout has been removed.",
      });

      return interaction.editReply(`✅ Timeout removed for **${member.user.tag}**.`);
    }

    return interaction.editReply("❌ Invalid subcommand.");
  } catch {
    return interaction.editReply("❌ Failed to execute timeout command.");
  }
}
