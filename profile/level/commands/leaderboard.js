import { EmbedBuilder } from "discord.js";
import { getGuildUsers } from "../storage.js";

export default async function leaderboard(interaction) {
  const users = await getGuildUsers(interaction.guild);

  const sorted = users
    .sort((a, b) => b.level - a.level || b.xp - a.xp)
    .slice(0, 10);

  if (!sorted.length) {
    return interaction.reply({ content: "No data yet.", ephemeral: true });
  }

  const entries = await Promise.all(
    sorted.map(async user => {
      const member = await interaction.guild.members
        .fetch(user.userId)
        .catch(() => null);
      const fallbackUser = member?.user
        ?? (await interaction.client.users.fetch(user.userId).catch(() => null));
      const tag = fallbackUser?.tag;
      return {
        ...user,
        tag,
      };
    })
  );

  const desc = entries
    .map((u, i) => {
      const mention = `<@${u.userId}>`;
      const name = u.tag ? ` (${u.tag})` : "";
      return `**${i + 1}.** ${mention}${name} — Level ${u.level}`;
    })
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("🏆 Leaderboard")
    .setDescription(desc)
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}
