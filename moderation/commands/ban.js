import { hasPermission, dmAffectedUser } from "../core.js";

export default async function ban(interaction, sub) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!hasPermission(interaction.member, "ban")) {
      return interaction.editReply("❌ You do not have permission to ban users.");
    }

    if (sub === "add") {
      const targetId = interaction.options.getString("target");
      const reason = interaction.options.getString("reason") ?? "No reason provided";

      const member = await interaction.guild.members.fetch(targetId).catch(() => null);

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

      return interaction.editReply(`🔨 User **${targetId}** has been banned.`);
    }

    if (sub === "remove") {
      const userId = interaction.options.getString("user_id");
      await interaction.guild.members.unban(userId);
      return interaction.editReply(`✅ User **${userId}** unbanned.`);
    }

    return interaction.editReply("❌ Invalid subcommand.");
  } catch {
    return interaction.editReply("❌ Failed to execute ban command.");
  }
}
