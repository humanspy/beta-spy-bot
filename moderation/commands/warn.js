import {
  getHighestStaffRole,
  hasPermission,
  createCaseAction,
  dmAffectedUser,
  isBotOwner,
  isBotOwnerBypass,
  logModerationAction,
} from "../core.js";

export async function warn(interaction, sub) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!(await hasPermission(interaction.member, "warn"))) {
      return interaction.editReply("❌ No permission.");
    }

    const user = interaction.options.getUser("user");
    const reason =
      interaction.options.getString("reason") ?? "No reason provided";
    const isBypassOwner = await isBotOwnerBypass(interaction.member);

    if (sub === "add") {
      const targetMember = await interaction.guild.members
        .fetch(user.id)
        .catch(() => null);
      if (targetMember) {
        const staffRole = await getHighestStaffRole(targetMember);
        if (staffRole && !isBotOwner(interaction.user)) {
          return interaction.editReply(
            "❌ Staff are immune to moderation unless a bot owner issues the command."
          );
        }
      }

      const severity =
        interaction.options.getString("severity") ?? "minor";

      const caseNumber = isBypassOwner
        ? null
        : await createCaseAction({
            guildId: interaction.guild.id,
            guildName: interaction.guild.name,
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
        actorMember: interaction.member,
        commandName: "warn",
        targetUser: user,
        guildName: interaction.guild.name,
        message: `You have been warned.\n\nSeverity: ${severity}\nReason: ${reason}`,
      });

      await logModerationAction({
        guild: interaction.guild,
        actor: interaction.user,
        actorMember: interaction.member,
        action: "⚠️ Warning Issued",
        target: `<@${user.id}> (${user.tag})`,
        reason,
        caseNumber,
        fields: [{ name: "Severity", value: severity, inline: true }],
        color: 0xf1c40f,
      });

      return interaction.editReply(
        caseNumber
          ? `⚠️ **${user.tag}** warned (Case #${caseNumber}).`
          : `⚠️ **${user.tag}** warned.`
      );
    }

    return interaction.editReply("❌ Invalid subcommand.");
  } catch {
    return interaction.editReply("❌ Failed to execute warn command.");
  }
}

export default warn;
