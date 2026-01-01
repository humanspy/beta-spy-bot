import fs from "fs/promises";
import crypto from "crypto";
import { ChannelType, EmbedBuilder } from "discord.js";
import { loadModmailConfig } from "./config.js";

const TICKETS_PATH = "./modmail/storage/tickets.json";
const APPEALS_PATH = "./modmail/storage/appeals.json";

/* ===================== JSON HELPERS ===================== */

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

/* ===================== CREATE TICKET ===================== */

export async function createTicket({
  guildId,
  userId,
  type,
  topic,
  client,
}) {
  const config = await loadModmailConfig(guildId);
  if (!config?.enabled) {
    throw new Error("ModMail not enabled");
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    throw new Error("Guild not found");
  }

  const forum = guild.channels.cache.get(config.forumChannelId);
  if (!forum || forum.type !== ChannelType.GuildForum) {
    throw new Error("ModMail forum misconfigured");
  }

  /* ===================== TAGS ===================== */

  const appliedTags = [];

  if (config.tags?.open) {
    appliedTags.push(config.tags.open);
  }

  const typeTag = forum.availableTags.find(
    t => t.name.toLowerCase() === type.toLowerCase()
  );

  if (typeTag) {
    appliedTags.push(typeTag.id);
  }

  /* ===================== EMBED ===================== */

  const embed = new EmbedBuilder()
    .setTitle(`📨 ${type}`)
    .addFields(
      { name: "User", value: `<@${userId}> (${userId})` },
      { name: "Topic", value: topic }
    )
    .setTimestamp();

  /* ===================== FORUM THREAD ===================== */

  const thread = await forum.threads.create({
    name: `${type} — ${userId}`,
    message: { embeds: [embed] },
    appliedTags,
  });

  /* ===================== SAVE ===================== */

  const tickets = await loadJSON(TICKETS_PATH, []);

  const ticket = {
    id: crypto.randomUUID(),
    guildId,
    userId,
    type,
    topic,
    threadId: thread.id,
    status: "open",
    createdAt: Date.now(),
  };

  tickets.push(ticket);
  await saveJSON(TICKETS_PATH, tickets);

  return ticket;
}

/* ===================== APPEALS ===================== */

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
