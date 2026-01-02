import { hasPermission, addWarning, dmAffectedUser } from "../core.js";

export default async function warn(interaction, sub) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!hasPermission(interaction.member, "warn")) {
      return interaction.editReply("❌ You do not have permission to warn users.");
    }

    if (sub === "add") {
      const user = interaction.options.getUser("user");
      const reason = interaction.options.getString("reason");
      const severity = interaction.options.getString("severity") ?? "moderate";

      await addWarning(
        interaction.guild.id,
        user.id,
        user.tag,
        interaction.user.id,
        interaction.user.tag,
        reason,
        severity
      );

      await dmAffectedUser({
        actor: interaction.user,
        commandName: "warn",
        targetUser: user,
        guildName: interaction.guild.name,
        message: `You have received a warning.\n\nSeverity: ${severity}\nReason: ${reason}`,
      });

      return interaction.editReply(`⚠️ **${user.tag}** has been warned.`);
    }

    return interaction.editReply("❌ Invalid subcommand.");
  } catch {
    return interaction.editReply("❌ Failed to execute warn command.");
  }
}
