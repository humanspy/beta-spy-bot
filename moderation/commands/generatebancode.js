import { EmbedBuilder } from "discord.js";
import {
  getHighestStaffRole,
  generateBanOverrideCode,
  getOverrideChannel,
} from "../core.js";

export default async function generatebancode(interaction) {
  const role = getHighestStaffRole(interaction.member);
  if (!role) return interaction.reply({ content: "❌ No permission", ephemeral: true });

  const code = await generateBanOverrideCode(
    interaction.user.tag,
    interaction.user.id
  );

  const embed = new EmbedBuilder()
    .setTitle("🔑 Ban Override Code")
    .setDescription(`\`${code}\``)
    .setColor(0x9b59b6);

  const channelId = getOverrideChannel(interaction.guild.id);
  const channel = await interaction.guild.channels.fetch(channelId);

  await channel.send({ embeds: [embed] });
  return interaction.reply({ content: "✅ Code generated", ephemeral: true });
}
