import { addXP, applyLevelRoles } from "./xp.js";

export async function handleLeveling(message) {
  if (!message.guild || message.author.bot) return;

  const result = addXP(message.guild.id, message.author.id);
  if (!result.leveledUp) return;

  const member = await message.guild.members
    .fetch(message.author.id)
    .catch(() => null);

  if (member) {
    await applyLevelRoles(member, result.level);
  }

  message.channel
    .send(`🎉 **${message.author.tag}** reached **Level ${result.level}**!`)
    .catch(() => {});
}
