import fs from "fs";
import path from "path";

const FILE = path.resolve("level/data.json");

if (!fs.existsSync(FILE)) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({}));
}

function load() {
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function getUserData(guildId, userId) {
  const data = load();
  data[guildId] ??= {};
  data[guildId][userId] ??= { xp: 0, level: 0 };
  save(data);
  return data[guildId][userId];
}

export function setUserData(guildId, userId, userData) {
  const data = load();
  data[guildId] ??= {};
  data[guildId][userId] = userData;
  save(data);
}

export function getGuildUsers(guildId) {
  const data = load();
  return data[guildId] ?? {};
}
