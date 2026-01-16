import {
  getCountingData,
  updateCountingData
} from "./storage.js";

import { getCountingWebhook } from "./webhook.js";

export async function handleCounting(message) {
  if (!message.guild) return;
  if (message.author.bot) return;

  const counting = await getCountingData(message.guild);

  if (!counting.channelId) return;
  if (message.channel.id !== counting.channelId) return;

  const value = Number(message.content.trim());

  if (!Number.isInteger(value)) {
    await message.delete().catch(() => {});
    return;
  }

  if (message.author.id === counting.lastUserId) {
    await message.delete().catch(() => {});
    await message.channel.send(
      "❌ You cannot count twice in a row. Count reset to **1**."
    );
    counting.current = 0;
    counting.lastUserId = null;
    await updateCountingData(message.guild, counting);
    return;
  }

  if (value !== counting.current + 1) {
    await message.delete().catch(() => {});
    await message.channel.send(
      `❌ Wrong number. Expected **${counting.current + 1}**. Count reset to **1**.`
    );
    counting.current = 0;
    counting.lastUserId = null;
    await updateCountingData(message.guild, counting);
    return;
  }

  const webhook = await getCountingWebhook(message.channel);

  await message.delete().catch(() => {});

  await webhook.send({
    content: `${value}`,
    username: message.member?.displayName || message.author.username,
    avatarURL: message.author.displayAvatarURL()
  });

  counting.current = value;
  counting.lastUserId = message.author.id;
  await updateCountingData(message.guild, counting);
}
