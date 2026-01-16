import {
  hasPermission,
  createCaseAction,
  dmAffectedUser,
  isBotOwnerBypass,
  logModerationAction,
} from "../core.js";

export async function kick(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!(await hasPermission(interaction.member, "kick"))) {
      return interaction.editReply("❌ No permission.");
    }

    const member = interaction.options.getMember("user");
    const reason =
      interaction.options.getString("reason") ?? "No reason provided";
    const isBypassOwner = await isBotOwnerBypass(interaction.member);

    if (!member || !member.kickable) {
      return interaction.editReply("❌ Cannot kick this user.");
    }

    await dmAffectedUser({
      actor: interaction.user,
      actorMember: interaction.member,
      commandName: "kick",
      targetUser: member.user,
      guildName: interaction.guild.name,
      message: `You have been kicked.\n\nReason: ${reason}`,
    });

    await member.kick(reason);

    const caseNumber = isBypassOwner
      ? null
      : await createCaseAction({
          guildId: interaction.guild.id,
          userId: member.id,
          username: member.user.tag,
          type: "KICK",
          moderatorId: interaction.user.id,
          moderatorName: interaction.user.tag,
          reason,
        });

    await logModerationAction({
      guild: interaction.guild,
      actor: interaction.user,
      actorMember: interaction.member,
      action: "👢 Kick",
      target: `<@${member.id}> (${member.user.tag})`,
      reason,
      caseNumber,
      color: 0xe67e22,
    });

    return interaction.editReply(
      caseNumber
        ? `👢 **${member.user.tag}** kicked (Case #${caseNumber}).`
        : `👢 **${member.user.tag}** kicked.`
    );
  } catch {
    return interaction.editReply("❌ Failed to kick user.");
  }
}

export default kick;
