import fs from "fs/promises";
import fsSync from "fs";
import path from "path";

/* ===================== PATHS ===================== */

const STORAGE_DIR = path.resolve("moderation/storage");
const CASES_FILE = path.join(STORAGE_DIR, "cases.json");
const CASES_FOLDER = path.join(STORAGE_DIR, "cases");

/* ===================== ORGANIZER ===================== */

export async function organizeCasesToFolder(caseData = null) {
  try {
    // Ensure folders exist
    if (!fsSync.existsSync(STORAGE_DIR)) {
      fsSync.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    if (!fsSync.existsSync(CASES_FOLDER)) {
      fsSync.mkdirSync(CASES_FOLDER, { recursive: true });
    }

    // Load cases
    const casesData =
      caseData ??
      JSON.parse(await fs.readFile(CASES_FILE, "utf8"));

    let cases = [];

    // Support both guild-scoped and flat structures
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

    // Get existing files
    const existingFiles = await fs.readdir(CASES_FOLDER);
    const existingUserFiles = existingFiles.filter(
      f => f.endsWith(".json") && f !== "index.json"
    );

    // Group cases by userId (safer than username)
    const casesByUser = {};

    for (const c of cases) {
      if (!casesByUser[c.userId]) {
        casesByUser[c.userId] = [];
      }
      casesByUser[c.userId].push(c);
    }

    const writtenFiles = new Set();
    const userIndex = [];

    for (const [userId, userCases] of Object.entries(casesByUser)) {
      userCases.sort((a, b) => a.caseNumber - b.caseNumber);

      const safeName =
        (userCases[0].username || userId).replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = `${safeName}_${userId}.json`;
      const filepath = path.join(CASES_FOLDER, filename);

      writtenFiles.add(filename);

      await fs.writeFile(
        filepath,
        JSON.stringify(
          {
            username: userCases[0].username,
            userId,
            totalCases: userCases.length,
            cases: userCases,
          },
          null,
          2
        )
      );

      userIndex.push({
        username: userCases[0].username,
        userId,
        filename,
        totalCases: userCases.length,
        latestCase: userCases[userCases.length - 1].caseNumber,
      });

      console.log(`✅ Synced ${filename} (${userCases.length} case(s))`);
    }

    // Remove obsolete files
    for (const file of existingUserFiles) {
      if (!writtenFiles.has(file)) {
        await fs.unlink(path.join(CASES_FOLDER, file));
        console.log(`🗑️ Removed old case file: ${file}`);
      }
    }

    // Write index
    userIndex.sort((a, b) => b.totalCases - a.totalCases);

    await fs.writeFile(
      path.join(CASES_FOLDER, "index.json"),
      JSON.stringify(
        {
          totalUsers: userIndex.length,
          totalCases: cases.length,
          lastUpdated: new Date().toISOString(),
          users: userIndex,
        },
        null,
        2
      )
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
    throw err;
  }
}

/* ===================== CLI SUPPORT ===================== */

if (import.meta.url === `file://${process.argv[1]}`) {
  organizeCasesToFolder();
}
