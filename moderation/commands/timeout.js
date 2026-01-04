import {
  hasPermission,
  createCaseAction,
  createRevertAction,
  dmAffectedUser,
} from "../core.js";
import { parseDuration } from "../utils/duration.js";

export async function timeout(interaction, sub) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!hasPermission(interaction.member, "timeout")) {
      return interaction.editReply("❌ No permission.");
    }

    const member = interaction.options.getMember("user");
    if (!member) return interaction.editReply("❌ User not found.");

    if (sub === "add") {
      const durationRaw = interaction.options.getString("duration");
      const reason =
        interaction.options.getString("reason") ?? "No reason provided";

      const durationMs = parseDuration(durationRaw);
      if (!durationMs) {
        return interaction.editReply("❌ Invalid duration.");
      }

      await member.timeout(durationMs, reason);

      const caseNumber = await createCaseAction({
        guildId: interaction.guild.id,
        userId: member.id,
        username: member.user.tag,
        type: "TIMEOUT",
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.tag,
        reason,
        duration: durationRaw,
      });

      await dmAffectedUser({
        actor: interaction.user,
        commandName: "timeout",
        targetUser: member.user,
        guildName: interaction.guild.name,
        message: `You have been timed out.\n\nDuration: ${durationRaw}\nReason: ${reason}`,
      });

      return interaction.editReply(
        `⏱️ **${member.user.tag}** timed out (Case #${caseNumber}).`
      );
    }

    if (sub === "remove") {
      await member.timeout(null);

      await createRevertAction({
        guildId: interaction.guild.id,
        userId: member.id,
        type: "UNTIMEOUT",
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.tag,
        reason: "Timeout removed",
      });

      return interaction.editReply(
        `✅ Timeout removed for **${member.user.tag}**.`
      );
    }

    return interaction.editReply("❌ Invalid subcommand.");
  } catch {
    return interaction.editReply("❌ Failed to execute timeout.");
  }
}

export default timeout;
