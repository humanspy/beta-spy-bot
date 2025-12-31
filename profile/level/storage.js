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

/* ===================== CORE ===================== */

/**
 * Load ALL XP data for a guild
 */
export function loadUserXP(guildId) {
  ensureDir();
  return readJSON(XP_FILE(guildId));
}

/**
 * Save ALL XP data for a guild
 */
export function saveUserXP(guildId, data) {
  ensureDir();
  writeJSON(XP_FILE(guildId), data);
}

/* ===================== USER API ===================== */

/**
 * Get or create XP data for a single user
 */
export function getUserData(guildId, userId) {
  const data = loadUserXP(guildId);

  if (!data[userId]) {
    data[userId] = {
      xp: 0,
      level: 0,
      messages: 0,
      lastMessage: 0,
    };

    saveUserXP(guildId, data);
  }

  return data[userId];
}

/**
 * Update XP data for a single user
 */
export function setUserData(guildId, userId, userData) {
  const data = loadUserXP(guildId);
  data[userId] = userData;
  saveUserXP(guildId, data);
}
