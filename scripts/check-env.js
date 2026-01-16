import "dotenv/config";

const requiredVars = ["DISCORD_BOT_TOKEN", "DISCORD_CLIENT_ID"];

const mysqlRequiredVars = ["MYSQLHOST", "MYSQLUSER", "MYSQLDATABASE"];
const mysqlUrl = process.env.MYSQL_URL ?? process.env.mysql_url;

const optionalVars = [
  "MYSQLPORT",
  "MYSQLPASSWORD",
  "DISCORD_BOT_OWNER_1",
  "DISCORD_BOT_OWNER_2",
  "RAILWAY_ENVIRONMENT",
  "RAILWAY_ENVIRONMENT_ID",
];

const missingRequired = requiredVars.filter(name => !process.env[name]);
const missingMysqlVars = mysqlRequiredVars.filter(name => !process.env[name]);
if (!mysqlUrl) {
  missingRequired.push(...missingMysqlVars);
}
const missingOptional = optionalVars.filter(name => !process.env[name]);

if (missingRequired.length === 0) {
  console.log("✅ Required environment variables are set.");
} else {
  console.error("❌ Missing required environment variables:");
  for (const name of missingRequired) {
    console.error(`- ${name}`);
  }
}

if (missingOptional.length > 0) {
  console.warn("⚠️ Missing optional environment variables:");
  for (const name of missingOptional) {
    console.warn(`- ${name}`);
  }
}

process.exit(missingRequired.length === 0 ? 0 : 1);
