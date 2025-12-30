export default async function skip(interaction) {
  const queue = interaction.client.player.nodes.get(interaction.guild.id);

  if (!queue || !queue.currentTrack) {
    return interaction.reply({
      content: "❌ Nothing is playing.",
      ephemeral: true
    });
  }

  const skipped = queue.currentTrack.title;

  try {
    await queue.node.skip();
    return interaction.reply(`⏭️ Skipped **${skipped}**`);
  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: "❌ Failed to skip the track.",
      ephemeral: true
    });
  }
}
