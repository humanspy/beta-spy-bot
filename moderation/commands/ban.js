import { hasPermission } from "../permissions.js";

export default async function ban(interaction, sub) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!hasPermission(interaction.member, "ban")) {
      return interaction.editReply("❌ You do not have permission to ban users.");
    }

    if (sub === "add") {
      const target = interaction.options.getString("target");
      const reason = interaction.options.getString("reason");
      const hackban = interaction.options.getBoolean("hackban") ?? false;
      const deleteDays = interaction.options.getInteger("delete_days") ?? 0;

      let dmFailed = false;

      if (hackban) {
        await interaction.guild.members.ban(target, {
          reason,
          deleteMessageSeconds: deleteDays * 86400,
        });

        return interaction.editReply(`🔨 User ID **${target}** has been hackbanned.`);
      }

      const member = await interaction.guild.members.fetch(target).catch(() => null);
      if (!member) {
        return interaction.editReply("❌ User not found.");
      }

      try {
        await member.user.send(
          `🔨 **You have been banned from ${interaction.guild.name}**\n\n` +
          `**Reason:** ${reason}\n\n` +
          `If you believe this was a mistake, you may appeal if the server allows it.`
        );
      } catch {
        dmFailed = true;
      }

      await member.ban({
        reason,
        deleteMessageSeconds: deleteDays * 86400,
      });

      return interaction.editReply(
        `🔨 **${member.user.tag}** has been banned.` +
        (dmFailed ? "\n⚠️ Could not send DM to the user." : "")
      );
    }

    if (sub === "remove") {
      const userId = interaction.options.getString("user_id");
      const reason = interaction.options.getString("reason") ?? "Unbanned";

      await interaction.guild.members.unban(userId, reason);

      return interaction.editReply(`✅ User **${userId}** has been unbanned.`);
    }

  } catch (err) {
    console.error("[BAN]", err);
    return interaction.editReply("❌ Failed to execute ban command.");
  }
}
