import "dotenv/config";
import { REST, Routes } from "discord.js";
import { SlashCommandBuilder } from "discord.js";

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

const setupCommand = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Initialize the bot for this server")
    .toJSON()
];

(async () => {
  try {
    console.log("📦 Registering /setup globally...");
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: setupCommand }
    );
    console.log("✅ /setup registered globally.");
  } catch (err) {
    console.error("❌ Failed to register /setup:", err);
  }
})();
