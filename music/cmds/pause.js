export default async function pause(interaction) {
  const queue = interaction.client.player.nodes.get(interaction.guild.id);

  if (!queue || !queue.isPlaying()) {
    return interaction.reply({
      content: "❌ Nothing is playing.",
      ephemeral: true
    });
  }

  queue.node.pause();
  return interaction.reply("⏸️ Music paused.");
}
