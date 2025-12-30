import { WebhookClient } from "discord.js";

const cache = new Map();

export async function getCountingWebhook(channel) {
  if (cache.has(channel.id)) {
    return cache.get(channel.id);
  }

  const hooks = await channel.fetchWebhooks();
  let hook = hooks.find(w => w.name === "Counting Webhook");

  if (!hook) {
    hook = await channel.createWebhook({ name: "Counting Webhook" });
  }

  const client = new WebhookClient({ url: hook.url });
  cache.set(channel.id, client);
  return client;
}
