import { handleModmailCommands } from "./commands/index.js";
import {
  handleModmailDM,
  handleModmailThreadMessage,
} from "./dmHandler.js";

/**
 * Slash-command entry for router.js
 */
export async function handleModmail(interaction) {
  if (!interaction.isChatInputCommand()) return false;
  return handleModmailCommands(interaction);
}

/**
 * Initialize ModMail message listeners
 * @param {import("discord.js").Client} client
 */
export function initModmail(client) {
  if (!client) {
    throw new Error("initModmail requires a Discord client");
  }

  client.on("messageCreate", async message => {
    try {
      await handleModmailDM(message, client);
      await handleModmailThreadMessage(message);
    } catch {
      // ModMail must never crash the bot
    }
  });
}
