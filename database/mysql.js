//mysql.js

import mysql from "mysql2/promise";

/**
 * Railway MySQL connection pool
 *
 * Required Railway env vars:
 * - MYSQLHOST
 * - MYSQLPORT
 * - MYSQLUSER
 * - MYSQLPASSWORD
 * - MYSQLDATABASE
 *
 * Alternatively:
 * - MYSQL_URL (or mysql_url)
 */

const mysqlUrl = process.env.MYSQL_URL ?? process.env.mysql_url;

if (
  !mysqlUrl &&
  (!process.env.MYSQLHOST ||
    !process.env.MYSQLUSER ||
    !process.env.MYSQLDATABASE)
) {
  console.warn(
    "⚠️ MySQL environment variables are missing. Database features may fail."
  );
}

const poolConfig = mysqlUrl
  ? { uri: mysqlUrl }
  : {
      host: process.env.MYSQLHOST,
      port: Number(process.env.MYSQLPORT ?? 3306),
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE,
    };

export const pool = mysql.createPool({
  ...poolConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Prevent timezone issues
  timezone: "Z",
  // Safer defaults
  decimalNumbers: true,
});

/* ===================== HEALTH CHECK ===================== */

/**
 * Optional helper to verify DB connectivity on startup
 * Does NOT throw – safe for production
 */
export async function testDatabaseConnection() {
  try {
    const [rows] = await pool.query("SELECT 1");
    console.log("✅ MySQL connected");
    return true;
  } catch (err) {
    console.error("❌ MySQL connection failed:", err.message);
    return false;
  }
}
