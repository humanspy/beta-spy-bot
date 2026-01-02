import { handleModmailCommands } from "./commands/index.js";

export async function handleModmail(interaction) {
  // Only handle chat input commands
  if (!interaction.isChatInputCommand()) return false;

  // Let the commands router decide
  return handleModmailCommands(interaction);
}

import {
  handleModmailDM,
  handleModmailThreadMessage,
} from "./dmHandler.js";

client.on("messageCreate", async message => {
  await handleModmailDM(message, client);
  await handleModmailThreadMessage(message);
});

