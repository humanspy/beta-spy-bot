import {
  hasPermission,
  createCaseAction,
  createRevertAction,
  dmAffectedUser,
  isBotOwnerBypass,
  logModerationAction,
} from "../core.js";

export async function ban(interaction, sub) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!(await hasPermission(interaction.member, "ban"))) {
      return interaction.editReply("❌ No permission.");
    }

    const reason =
      interaction.options.getString("reason") ?? "No reason provided";
    const isBypassOwner = await isBotOwnerBypass(interaction.member);

    if (sub === "add") {
      const targetId = interaction.options.getString("target");
      const member = await interaction.guild.members
        .fetch(targetId)
        .catch(() => null);

      if (member) {
        await dmAffectedUser({
          actor: interaction.user,
          actorMember: interaction.member,
          commandName: "ban",
          targetUser: member.user,
          guildName: interaction.guild.name,
          message: `You have been banned.\n\nReason: ${reason}`,
        });
      }

      await interaction.guild.members.ban(targetId, { reason });

      const caseNumber = isBypassOwner
        ? null
        : await createCaseAction({
            guildId: interaction.guild.id,
            userId: targetId,
            username: member?.user.tag ?? targetId,
            type: "BAN",
            moderatorId: interaction.user.id,
            moderatorName: interaction.user.tag,
            reason,
          });

      await logModerationAction({
        guild: interaction.guild,
        actor: interaction.user,
        actorMember: interaction.member,
        action: "🔨 Ban Issued",
        target: member?.user
          ? `<@${member.user.id}> (${member.user.tag})`
          : targetId,
        reason,
        caseNumber,
        color: 0xe74c3c,
      });

      return interaction.editReply(
        caseNumber
          ? `🔨 User **${targetId}** banned (Case #${caseNumber}).`
          : `🔨 User **${targetId}** banned.`
      );
    }

    if (sub === "remove") {
      const userId = interaction.options.getString("user_id");

      await interaction.guild.members.unban(userId);

      if (!isBypassOwner) {
        await createRevertAction({
          guildId: interaction.guild.id,
          userId,
          type: "UNBAN",
          moderatorId: interaction.user.id,
          moderatorName: interaction.user.tag,
          reason: "User unbanned",
        });
      }

      await logModerationAction({
        guild: interaction.guild,
        actor: interaction.user,
        actorMember: interaction.member,
        action: "✅ Unban",
        target: userId,
        reason: "User unbanned",
        color: 0x57f287,
      });

      return interaction.editReply(`✅ User **${userId}** unbanned.`);
    }

    return interaction.editReply("❌ Invalid subcommand.");
  } catch {
    return interaction.editReply("❌ Failed to execute ban.");
  }
}

export default ban;
