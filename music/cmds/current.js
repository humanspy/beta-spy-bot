import { EmbedBuilder } from "discord.js";

export default async function current(interaction) {
  const queue = interaction.client.player.nodes.get(interaction.guild.id);

  if (!queue || !queue.currentTrack) {
    return interaction.reply({
      content: "❌ Nothing is playing.",
      ephemeral: true
    });
  }

  const track = queue.currentTrack;

  const embed = new EmbedBuilder()
    .setTitle("🎵 Now Playing")
    .setDescription(`**${track.title}**`)
    .setThumbnail(track.thumbnail)
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}
