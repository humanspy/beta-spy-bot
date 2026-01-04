import fs from "fs/promises";
import fsSync from "fs";
import path from "path";

/* ===================== PATHS ===================== */

const STORAGE_DIR = path.resolve("moderation/storage");
const CASES_FILE = path.join(STORAGE_DIR, "cases.json");
const CASES_FOLDER = path.join(STORAGE_DIR, "cases");

/* ===================== SAFE JSON LOADER ===================== */

async function loadSafeJSON(file, fallback = {}) {
  try {
    if (!fsSync.existsSync(file)) return fallback;

    const raw = await fs.readFile(file, "utf8");

    // Empty or whitespace-only file
    if (!raw || !raw.trim()) return fallback;

    return JSON.parse(raw);
  } catch {
    // Corrupted JSON → recover safely
    return fallback;
  }
}

async function saveSafeJSON(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });

  // Atomic write (prevents partial writes)
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}

/* ===================== ORGANIZER ===================== */

export async function organizeCasesToFolder(caseData = null) {
  try {
    /* ===================== ENSURE STRUCTURE ===================== */

    if (!fsSync.existsSync(STORAGE_DIR)) {
      fsSync.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    if (!fsSync.existsSync(CASES_FOLDER)) {
      fsSync.mkdirSync(CASES_FOLDER, { recursive: true });
    }

    /* ===================== LOAD CASES SAFELY ===================== */

    const casesData =
      caseData ??
      (await loadSafeJSON(CASES_FILE, {}));

    // Self-heal cases.json so it is never empty or corrupted again
    await saveSafeJSON(CASES_FILE, casesData);

    let cases = [];

    /* ===================== NORMALIZE STRUCTURE ===================== */

    if (Array.isArray(casesData.cases)) {
      cases = casesData.cases;
    } else if (casesData && typeof casesData === "object") {
      for (const guildId of Object.keys(casesData)) {
        const g = casesData[guildId];
        if (g && Array.isArray(g.cases)) {
          cases.push(...g.cases);
        }
      }
    }

    /* ===================== GROUP BY USER ===================== */

    const casesByUser = {};

    for (const c of cases) {
      if (!c?.userId) continue;

      casesByUser[c.userId] ??= [];
      casesByUser[c.userId].push(c);
    }

    const existingFiles = await fs.readdir(CASES_FOLDER);
    const existingUserFiles = existingFiles.filter(
      f => f.endsWith(".json") && f !== "index.json"
    );

    const writtenFiles = new Set();
    const userIndex = [];

    /* ===================== WRITE USER FILES ===================== */

    for (const [userId, userCases] of Object.entries(casesByUser)) {
      userCases.sort((a, b) => a.caseNumber - b.caseNumber);

      const safeName = (userCases[0].username || userId)
        .replace(/[^a-zA-Z0-9_-]/g, "_");

      const filename = `${safeName}_${userId}.json`;
      const filepath = path.join(CASES_FOLDER, filename);

      writtenFiles.add(filename);

      await saveSafeJSON(filepath, {
        username: userCases[0].username,
        userId,
        totalCases: userCases.length,
        cases: userCases,
      });

      userIndex.push({
        username: userCases[0].username,
        userId,
        filename,
        totalCases: userCases.length,
        latestCase: userCases[userCases.length - 1].caseNumber,
      });
    }

    /* ===================== CLEAN OLD FILES ===================== */

    for (const file of existingUserFiles) {
      if (!writtenFiles.has(file)) {
        await fs.unlink(path.join(CASES_FOLDER, file));
      }
    }

    /* ===================== WRITE INDEX ===================== */

    userIndex.sort((a, b) => b.totalCases - a.totalCases);

    await saveSafeJSON(
      path.join(CASES_FOLDER, "index.json"),
      {
        totalUsers: userIndex.length,
        totalCases: cases.length,
        lastUpdated: new Date().toISOString(),
        users: userIndex,
      }
    );

    console.log(
      `📁 Cases organized: ${cases.length} cases, ${userIndex.length} users`
    );

    return {
      totalUsers: userIndex.length,
      totalCases: cases.length,
    };
  } catch (err) {
    console.error("❌ Error organizing cases:", err);
    return { totalUsers: 0, totalCases: 0 };
  }
}

/* ===================== CLI SUPPORT ===================== */

if (import.meta.url === `file://${process.argv[1]}`) {
  organizeCasesToFolder();
}
