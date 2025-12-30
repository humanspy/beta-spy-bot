import fs from "fs/promises";

const FILE = "./counting/data.json";

async function load() {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return {};
  }
}

async function save(data) {
  await fs.mkdir("./counting", { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2));
}

export async function getCountingData(guildId) {
  const data = await load();
  if (!data[guildId]) {
    data[guildId] = {
      setupCompleted: false,
      channelId: null,
      current: 0,
      lastUserId: null
    };
    await save(data);
  }
  return data[guildId];
}

export async function enableCounting(guildId, channelId) {
  const data = await load();
  data[guildId] = {
    setupCompleted: true,
    channelId,
    current: 0,
    lastUserId: null
  };
  await save(data);
}

export async function updateCountingData(guildId, newData) {
  const data = await load();
  data[guildId] = newData;
  await save(data);
}
