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
 */

if (
  !process.env.MYSQLHOST ||
  !process.env.MYSQLUSER ||
  !process.env.MYSQLDATABASE
) {
  console.warn(
    "⚠️ MySQL environment variables are missing. Database features may fail."
  );
}

export const pool = mysql.createPool({
  host: process.env.MYSQLHOST,
  port: Number(process.env.MYSQLPORT ?? 3306),
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,

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
