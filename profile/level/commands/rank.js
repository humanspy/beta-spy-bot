import { EmbedBuilder } from "discord.js";
import { getUserData } from "../storage.js";

export default async function rank(interaction) {
  const user = interaction.options.getUser("user") || interaction.user;
  const data = getUserData(interaction.guild.id, user.id);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🏆 Rank")
    .addFields(
      { name: "User", value: user.tag, inline: true },
      { name: "Level", value: `${data.level}`, inline: true },
      { name: "XP", value: `${data.xp}`, inline: true }
    )
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}
