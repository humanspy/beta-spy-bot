import {
  handleModmailDM,
  handleModmailThreadMessage,
} from "./dmHandler.js";

/**
 * Initialize ModMail listeners
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
      // silent – modmail must never crash the bot
    }
  });
}
