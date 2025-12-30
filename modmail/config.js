import fs from "fs/promises";

const CONFIG_PATH = "./modmail/storage/config.json";

async function loadAll() {
  try {
    return JSON.parse(await fs.readFile(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

async function saveAll(data) {
  await fs.mkdir("./modmail/storage", { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(data, null, 2));
}

export async function loadModmailConfig(guildId) {
  const data = await loadAll();
  return data[guildId] ?? null;
}

export async function saveModmailConfig(guildId, config) {
  const data = await loadAll();
  data[guildId] = config;
  await saveAll(data);
}
