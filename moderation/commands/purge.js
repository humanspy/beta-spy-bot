export default async function purge(interaction) {
  const amount = interaction.options.getInteger("amount");
  const targetUser = interaction.options.getUser("user");

  let deleted;
  if (targetUser) {
    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    const userMessages = messages
      .filter(m => m.author.id === targetUser.id)
      .first(amount);
    deleted = await interaction.channel.bulkDelete(userMessages, true);
  } else {
    deleted = await interaction.channel.bulkDelete(amount, true);
  }

  return interaction.reply({
    content: `🗑️ Deleted **${deleted.size}** message(s)`,
    flags: 64,
  });
}

