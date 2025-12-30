import { EmbedBuilder } from "discord.js";
import {
  getHighestStaffRole,
  generateBanOverrideCode,
  getOverrideChannel,
} from "../core.js";

export default async function generatebancode(interaction) {
  const role = getHighestStaffRole(interaction.member);
  if (!role) {
    return interaction.reply({
      content: "❌ No permission.",
      ephemeral: true,
    });
  }

  const code = await generateBanOverrideCode(
    interaction.user.tag,
    interaction.user.id
  );

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("🔑 Ban Override Code")
    .addFields(
      { name: "Code", value: `\`${code}\`` },
      { name: "Valid For", value: "One-time use only" }
    )
    .setTimestamp();

  const channelId = getOverrideChannel(interaction.guild.id);
  const channel = await interaction.guild.channels.fetch(channelId);

  await channel.send({ embeds: [embed] });

  return interaction.reply({
    content: `✅ Override code posted in <#${channelId}>`,
    ephemeral: true,
  });
}
