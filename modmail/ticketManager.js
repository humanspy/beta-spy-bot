import fs from "fs/promises";
import crypto from "crypto";
import { ChannelType, EmbedBuilder } from "discord.js";
import { loadModmailConfig } from "./config.js";

const TICKETS_PATH = "./modmail/storage/tickets.json";
const APPEALS_PATH = "./modmail/storage/appeals.json";

async function loadJSON(path, fallback) {
  try {
    return JSON.parse(await fs.readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function saveJSON(path, data) {
  await fs.mkdir("./modmail/storage", { recursive: true });
  await fs.writeFile(path, JSON.stringify(data, null, 2));
}

export async function createTicket({ guildId, userId, type, topic, client }) {
  const config = await loadModmailConfig(guildId);
  if (!config?.enabled) throw new Error();

  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error();

  const forum = guild.channels.cache.get(config.forumChannelId);
  if (!forum || forum.type !== ChannelType.GuildForum) throw new Error();

  const embed = new EmbedBuilder()
    .setTitle(`📨 ${type}`)
    .addFields(
      { name: "User", value: `<@${userId}> (${userId})` },
      { name: "Topic", value: topic }
    )
    .setTimestamp();

  const thread = await forum.threads.create({
    name: `${type} -- ${userId}`,
    message: { embeds: [embed] },
    appliedTags: [config.tags?.open].filter(Boolean),
  });

  const tickets = await loadJSON(TICKETS_PATH, []);
  tickets.push({
    id: crypto.randomUUID(),
    guildId,
    userId,
    type,
    topic,
    threadId: thread.id,
    createdAt: Date.now(),
  });

  await saveJSON(TICKETS_PATH, tickets);
  return tickets.at(-1);
}

export async function getAppealCount(guildId, userId) {
  const data = await loadJSON(APPEALS_PATH, {});
  return data[guildId]?.[userId] ?? 0;
}

export async function incrementAppealCount(guildId, userId) {
  const data = await loadJSON(APPEALS_PATH, {});
  data[guildId] ??= {};
  data[guildId][userId] = (data[guildId][userId] ?? 0) + 1;
  await saveJSON(APPEALS_PATH, data);
}
