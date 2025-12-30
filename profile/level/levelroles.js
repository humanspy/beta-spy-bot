import fs from "fs";
import path from "path";

const FILE = path.resolve("profile/level/roles.json");

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

export function getLevelRoleConfig(guildId) {
  const data = load();
  return (
    data[guildId] ?? {
      interval: 1,
      removePrevious: false,
      roles: {},
    }
  );
}

export function setLevelRoleConfig(guildId, config) {
  const data = load();
  data[guildId] = config;
  save(data);
}
