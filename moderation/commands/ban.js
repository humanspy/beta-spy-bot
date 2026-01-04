import {
  hasPermission,
  createCaseAction,
  createRevertAction,
  dmAffectedUser,
} from "../core.js";

export async function ban(interaction, sub) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!hasPermission(interaction.member, "ban")) {
      return interaction.editReply("❌ No permission.");
    }

    const reason =
      interaction.options.getString("reason") ?? "No reason provided";

    if (sub === "add") {
      const targetId = interaction.options.getString("target");
      const member = await interaction.guild.members
        .fetch(targetId)
        .catch(() => null);

      if (member) {
        await dmAffectedUser({
          actor: interaction.user,
          commandName: "ban",
          targetUser: member.user,
          guildName: interaction.guild.name,
          message: `You have been banned.\n\nReason: ${reason}`,
        });
      }

      await interaction.guild.members.ban(targetId, { reason });

      const caseNumber = await createCaseAction({
        guildId: interaction.guild.id,
        userId: targetId,
        username: member?.user.tag ?? targetId,
        type: "BAN",
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.tag,
        reason,
      });

      return interaction.editReply(
        `🔨 User **${targetId}** banned (Case #${caseNumber}).`
      );
    }

    if (sub === "remove") {
      const userId = interaction.options.getString("user_id");

      await interaction.guild.members.unban(userId);

      await createRevertAction({
        guildId: interaction.guild.id,
        userId,
        type: "UNBAN",
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.tag,
        reason: "User unbanned",
      });

      return interaction.editReply(`✅ User **${userId}** unbanned.`);
    }

    return interaction.editReply("❌ Invalid subcommand.");
  } catch {
    return interaction.editReply("❌ Failed to execute ban.");
  }
}

export default ban;
