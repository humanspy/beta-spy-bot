import { EmbedBuilder } from "discord.js";
import { getUserData } from "../storage.js";

function renderProgressBar(current, total, size = 10) {
  const safeTotal = total > 0 ? total : 1;
  const ratio = Math.min(current / safeTotal, 1);
  const filled = Math.round(ratio * size);
  const empty = size - filled;
  return "▰".repeat(filled) + "▱".repeat(empty);
}

export default async function rank(interaction) {
  const user = interaction.options.getUser("user") || interaction.user;
  const data = await getUserData(interaction.guild, user.id);
  const needed = Math.max(100, data.level * 100);
  const progressBar = renderProgressBar(data.xp, needed);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🏆 Rank")
    .addFields(
      { name: "User", value: user.tag, inline: true },
      { name: "Level", value: `${data.level}`, inline: true },
      { name: "XP", value: `${data.xp}`, inline: true },
      {
        name: "Progress",
        value: `${progressBar}\n${data.xp}/${needed} XP`,
      }
    )
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}
