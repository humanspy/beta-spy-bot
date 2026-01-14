import { hasPermission, logModerationAction } from "../core.js";

export async function purge(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!(await hasPermission(interaction.member, "purge"))) {
      return interaction.editReply("❌ No permission.");
    }

    const amount = interaction.options.getInteger("amount");
    const targetUser = interaction.options.getUser("user");
    const maxAmount = 1000;

    if (!amount || amount < 1 || amount > maxAmount) {
      return interaction.editReply(
        `❌ Amount must be between 1 and ${maxAmount}.`
      );
    }

    const messagesToDelete = [];
    let lastId;

    while (messagesToDelete.length < amount) {
      const batch = await interaction.channel.messages.fetch({
        limit: 100,
        ...(lastId ? { before: lastId } : {}),
      });

      if (!batch.size) break;

      const filtered = targetUser
        ? batch.filter(m => m.author.id === targetUser.id)
        : batch;

      for (const message of filtered.values()) {
        if (messagesToDelete.length >= amount) break;
        messagesToDelete.push(message);
      }

      lastId = batch.last().id;
      if (batch.size < 100) break;
    }

    const now = Date.now();
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
    const bulkDeleteable = messagesToDelete.filter(
      message => now - message.createdTimestamp < fourteenDaysMs
    );
    const manualDelete = messagesToDelete.filter(
      message => now - message.createdTimestamp >= fourteenDaysMs
    );

    let deletedCount = 0;
    for (let i = 0; i < bulkDeleteable.length; i += 100) {
      const chunk = bulkDeleteable.slice(i, i + 100);
      const deleted = await interaction.channel.bulkDelete(chunk, true);
      deletedCount += deleted.size;
    }

    for (const message of manualDelete) {
      try {
        await message.delete();
        deletedCount += 1;
      } catch {
        // ignore failed deletes (missing perms or already deleted)
      }
    }

    await logModerationAction({
      guild: interaction.guild,
      actor: interaction.user,
      actorMember: interaction.member,
      action: "🧹 Purge",
      target: targetUser
        ? `<@${targetUser.id}> (${targetUser.tag})`
        : "Channel messages",
      reason: `Deleted ${deletedCount} messages`,
      fields: [
        { name: "Requested", value: String(amount), inline: true },
        { name: "Deleted", value: String(deletedCount), inline: true },
      ],
      color: 0x95a5a6,
    });

    return interaction.editReply(
      `🗑️ Deleted **${deletedCount}** messages.`
    );
  } catch {
    return interaction.editReply("❌ Failed to purge messages.");
  }
}

export default purge;
