import { hasPermission, createCaseAction } from "../core.js";

export async function purge(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!hasPermission(interaction.member, "purge")) {
      return interaction.editReply("❌ No permission.");
    }

    const amount = interaction.options.getInteger("amount");
    const targetUser = interaction.options.getUser("user");

    let deleted;

    if (targetUser) {
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const filtered = messages
        .filter(m => m.author.id === targetUser.id)
        .first(amount);
      deleted = await interaction.channel.bulkDelete(filtered, true);
    } else {
      deleted = await interaction.channel.bulkDelete(amount, true);
    }

    const caseNumber = await createCaseAction({
      guildId: interaction.guild.id,
      userId: targetUser?.id ?? "CHANNEL",
      username: targetUser?.tag ?? "Multiple users",
      type: "PURGE",
      moderatorId: interaction.user.id,
      moderatorName: interaction.user.tag,
      reason: `Deleted ${deleted.size} messages`,
    });

    return interaction.editReply(
      `🗑️ Deleted **${deleted.size}** messages (Case #${caseNumber}).`
    );
  } catch {
    return interaction.editReply("❌ Failed to purge messages.");
  }
}

export default purge;
