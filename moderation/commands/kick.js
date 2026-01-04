import {
  hasPermission,
  createCaseAction,
  dmAffectedUser,
} from "../core.js";

export async function kick(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!hasPermission(interaction.member, "kick")) {
      return interaction.editReply("❌ No permission.");
    }

    const member = interaction.options.getMember("user");
    const reason =
      interaction.options.getString("reason") ?? "No reason provided";

    if (!member || !member.kickable) {
      return interaction.editReply("❌ Cannot kick this user.");
    }

    await dmAffectedUser({
      actor: interaction.user,
      commandName: "kick",
      targetUser: member.user,
      guildName: interaction.guild.name,
      message: `You have been kicked.\n\nReason: ${reason}`,
    });

    await member.kick(reason);

    const caseNumber = await createCaseAction({
      guildId: interaction.guild.id,
      userId: member.id,
      username: member.user.tag,
      type: "KICK",
      moderatorId: interaction.user.id,
      moderatorName: interaction.user.tag,
      reason,
    });

    return interaction.editReply(
      `👢 **${member.user.tag}** kicked (Case #${caseNumber}).`
    );
  } catch {
    return interaction.editReply("❌ Failed to kick user.");
  }
}

export default kick;
