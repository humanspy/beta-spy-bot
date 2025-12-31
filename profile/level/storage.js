import fs from "fs";
import path from "path";

const DATA_DIR = "./data/levels";
const XP_FILE = guildId => path.join(DATA_DIR, `${guildId}.json`);

/* ===================== HELPERS ===================== */

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON(file) {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/* ===================== EXPORTS ===================== */

/**
 * Load XP data for a guild
 */
export function loadUserXP(guildId) {
  ensureDir();
  return readJSON(XP_FILE(guildId));
}

/**
 * Save XP data for a guild
 */
export function saveUserXP(guildId, data) {
  ensureDir();
  writeJSON(XP_FILE(guildId), data);
}
