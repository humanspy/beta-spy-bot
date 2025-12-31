import fs from "fs";
import path from "path";

const FILE = path.resolve("staff-config.json");

function load() {
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "{}");
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function getStaffConfig(guildId) {
  return load()[guildId] ?? null;
}

export function saveStaffConfig(guildId, config) {
  const data = load();
  data[guildId] = config;
  save(data);
}

export function deleteStaffConfig(guildId) {
  const data = load();
  delete data[guildId];
  save(data);
}
