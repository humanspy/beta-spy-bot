import fs from "fs/promises";
import crypto from "crypto";

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

/* ===================== TICKETS ===================== */

export async function createTicket({ guildId, userId, type, topic }) {
  const tickets = await loadJSON(TICKETS_PATH, []);

  const ticket = {
    id: crypto.randomUUID(),
    guildId,
    userId,
    type,
    topic,
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
