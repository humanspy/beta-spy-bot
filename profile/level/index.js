// profile/level/index.js
import { addXP, applyLevelRoles } from "./xp.js";

export async function handleLeveling(message) {
  if (!message.guild) return;
  if (message.author.bot) return;

  const result = addXP(message.guild.id, message.author.id);

  if (!result.leveledUp) return;

  const member = await message.guild.members
    .fetch(message.author.id)
    .catch(() => null);

  if (member) {
    // Applies roles ONLY if lvlroles are configured
    await applyLevelRoles(member, result.level);
  }

  // Always announce the level-up in the same channel
  await message.channel.send(
    `🎉 **${message.author.tag}** reached **Level ${result.level}**!`
  ).catch(() => {});
}
