import {
  hasPermission,
  createCaseAction,
  createRevertAction,
  dmAffectedUser,
} from "../core.js";

export async function warn(interaction, sub) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!hasPermission(interaction.member, "warn")) {
      return interaction.editReply("❌ No permission.");
    }

    const user = interaction.options.getUser("user");
    const reason =
      interaction.options.getString("reason") ?? "No reason provided";

    if (sub === "add") {
      const severity =
        interaction.options.getString("severity") ?? "minor";

      const caseNumber = await createCaseAction({
        guildId: interaction.guild.id,
        userId: user.id,
        username: user.tag,
        type: "WARN",
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.tag,
        reason,
        severity,
      });

      await dmAffectedUser({
        actor: interaction.user,
        commandName: "warn",
        targetUser: user,
        guildName: interaction.guild.name,
        message: `You have been warned.\n\nSeverity: ${severity}\nReason: ${reason}`,
      });

      return interaction.editReply(
        `⚠️ **${user.tag}** warned (Case #${caseNumber}).`
      );
    }

    if (sub === "revert") {
      await createRevertAction({
        guildId: interaction.guild.id,
        userId: user.id,
        type: "REVERT_WARN",
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.tag,
        reason: "Warning reverted",
      });

      return interaction.editReply(`✅ Warning reverted for **${user.tag}**.`);
    }

    return interaction.editReply("❌ Invalid subcommand.");
  } catch {
    return interaction.editReply("❌ Failed to execute warn command.");
  }
}

export default warn;
