export default async function stop(interaction) {
  const queue = interaction.client.player.nodes.get(interaction.guild.id);

  if (!queue) {
    return interaction.reply({
      content: "❌ No active queue.",
      flags: 64,
    });
  }

  queue.delete();
  return interaction.reply("⏹️ Music stopped and left the voice channel.");
}

