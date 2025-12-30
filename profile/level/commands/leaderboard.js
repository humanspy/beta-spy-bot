import { EmbedBuilder } from "discord.js";
import { getGuildUsers } from "../storage.js";

export default async function leaderboard(interaction) {
  const users = getGuildUsers(interaction.guild.id);

  const sorted = Object.entries(users)
    .sort((a, b) => b[1].level - a[1].level || b[1].xp - a[1].xp)
    .slice(0, 10);

  if (!sorted.length) {
    return interaction.reply({ content: "No data yet.", ephemeral: true });
  }

  const desc = sorted
    .map(([id, u], i) => `**${i + 1}.** <@${id}> — Level ${u.level}`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("🏆 Leaderboard")
    .setDescription(desc)
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}
