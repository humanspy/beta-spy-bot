import { handleModmailCommands } from "./commands/index.js";
import {
  handleModmailDM,
  handleModmailThreadMessage,
} from "./dmHandler.js";
import { sweepInactiveTickets } from "./ticketManager.js";

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

  const sweepIntervalMs = 60 * 60 * 1000;
  const inactivityMs = 24 * 60 * 60 * 1000;
  setInterval(() => {
    sweepInactiveTickets(client, inactivityMs).catch(() => {});
  }, sweepIntervalMs);
}
