import {
  hasPermission,
  createCaseAction,
  createRevertAction,
  dmAffectedUser,
  isBotOwnerBypass,
  logModerationAction,
} from "../core.js";
import { parseDuration } from "../utils/duration.js";

export async function timeout(interaction, sub) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!(await hasPermission(interaction.member, "timeout"))) {
      return interaction.editReply("❌ No permission.");
    }

    const member = interaction.options.getMember("user");
    if (!member) return interaction.editReply("❌ User not found.");
    const isBypassOwner = await isBotOwnerBypass(interaction.member);

    if (sub === "add") {
      const durationRaw = interaction.options.getString("duration");
      const reason =
        interaction.options.getString("reason") ?? "No reason provided";

      const durationMs = parseDuration(durationRaw);
      if (!durationMs) {
        return interaction.editReply("❌ Invalid duration.");
      }

      await member.timeout(durationMs, reason);

      const caseNumber = isBypassOwner
        ? null
        : await createCaseAction({
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
        actorMember: interaction.member,
        commandName: "timeout",
        targetUser: member.user,
        guildName: interaction.guild.name,
        message: `You have been timed out.\n\nDuration: ${durationRaw}\nReason: ${reason}`,
      });

      await logModerationAction({
        guild: interaction.guild,
        actor: interaction.user,
        actorMember: interaction.member,
        action: "⏱️ Timeout",
        target: `<@${member.id}> (${member.user.tag})`,
        reason,
        caseNumber,
        fields: [{ name: "Duration", value: durationRaw, inline: true }],
        color: 0xf39c12,
      });

      return interaction.editReply(
        caseNumber
          ? `⏱️ **${member.user.tag}** timed out (Case #${caseNumber}).`
          : `⏱️ **${member.user.tag}** timed out.`
      );
    }

    if (sub === "remove") {
      await member.timeout(null);

      if (!isBypassOwner) {
        await createRevertAction({
          guildId: interaction.guild.id,
          userId: member.id,
          type: "UNMUTE",
          moderatorId: interaction.user.id,
          moderatorName: interaction.user.tag,
          reason: "Timeout removed",
        });
      }

      await logModerationAction({
        guild: interaction.guild,
        actor: interaction.user,
        actorMember: interaction.member,
        action: "✅ Timeout Removed",
        target: `<@${member.id}> (${member.user.tag})`,
        reason: "Timeout removed",
        color: 0x57f287,
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
