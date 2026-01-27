import { EmbedBuilder } from "discord.js";

export default async function help(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("📋 Moderation Commands")
    .setDescription(
      "**/warn add**\n" +
      "**/timeout add | remove**\n" +
      "**/ban add | remove**\n" +
      "**/case view | remove | delete**\n" +
      "**/purge**\n" +
      "**/kick**\n" +
      "**/staffwarn add | list | modify**\n" +
      "**/promote**\n" +
      "**/demote**\n" +
      "**/generatebancode**\n" +
      "**/regentimer**"
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}
