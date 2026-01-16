import "dotenv/config";

const requiredVars = [
  "DISCORD_BOT_TOKEN",
  "DISCORD_CLIENT_ID",
  "MYSQLHOST",
  "MYSQLUSER",
  "MYSQLDATABASE",
];

const optionalVars = [
  "MYSQLPORT",
  "MYSQLPASSWORD",
  "DISCORD_BOT_OWNER_1",
  "DISCORD_BOT_OWNER_2",
  "RAILWAY_ENVIRONMENT",
];

const missingRequired = requiredVars.filter(name => !process.env[name]);
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
