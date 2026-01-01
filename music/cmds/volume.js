import { setGuildVolume } from "../storage/volume.js";

export default async function volume(interaction) {
  const level = interaction.options.getInteger("level");
  const queue = interaction.client.player.nodes.get(interaction.guild.id);

  if (!queue) {
    return interaction.reply({ content: "❌ No active queue.", flags: 64, });
  }

  if (level < 0 || level > 100) {
    return interaction.reply({ content: "❌ Volume must be 0–100.", flags: 64, });
  }

  queue.node.setVolume(level);
  setGuildVolume(interaction.guild.id, level);

  return interaction.reply(`🔊 Volume set to **${level}%**`);
}

