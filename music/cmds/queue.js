import { EmbedBuilder } from "discord.js";

export default async function queueCmd(interaction) {
  const queue = interaction.client.player.nodes.get(interaction.guild.id);

  if (!queue || !queue.tracks.size) {
    return interaction.reply({
      content: "❌ Queue is empty.",
      flags: 64,
    });
  }

  const tracks = queue.tracks.toArray().slice(0, 10);

  const embed = new EmbedBuilder()
    .setTitle("🎶 Music Queue")
    .setDescription(
      tracks.map((t, i) => `${i + 1}. **${t.title}**`).join("\n")
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

