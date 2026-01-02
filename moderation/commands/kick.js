import { hasPermission, dmAffectedUser } from "../core.js";

export default async function kick(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!hasPermission(interaction.member, "kick")) {
      return interaction.editReply("❌ You do not have permission to kick users.");
    }

    const member = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    if (!member || !member.kickable) {
      return interaction.editReply("❌ Unable to kick this user.");
    }

    await dmAffectedUser({
      actor: interaction.user,
      commandName: "kick",
      targetUser: member.user,
      guildName: interaction.guild.name,
      message: `You have been kicked.\n\nReason: ${reason}`,
    });

    await member.kick(reason);

    return interaction.editReply(`👢 **${member.user.tag}** has been kicked.`);
  } catch {
    return interaction.editReply("❌ Failed to execute kick command.");
  }
}
