import { EmbedBuilder } from "discord.js";

export default async function help(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("📋 Moderation Commands")
    .setDescription(
      "**/warn add | remove**\n" +
      "**/timeout add | remove**\n" +
      "**/ban add | remove**\n" +
      "**/case view | delete**\n" +
      "**/purge**\n" +
      "**/kick**\n" +
      "**/staffwarn add | remove | list | config**\n" +
      "**/generatebancode**"
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}
