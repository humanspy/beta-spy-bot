import fs from "fs";
import path from "path";

const FILE = path.resolve("music/storage/volume.json");

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

export function getGuildVolume(guildId) {
  const data = load();
  return data[guildId] ?? 50;
}

export function setGuildVolume(guildId, volume) {
  const data = load();
  data[guildId] = volume;
  save(data);
}
