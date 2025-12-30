import setup from "./setup.js";
import settings from "./settings.js";

export async function handleModmailCommands(interaction) {
  if (interaction.commandName !== "modmail") return false;

  const sub = interaction.options.getSubcommand();

  if (sub === "setup") {
    await setup(interaction);
    return true;
  }

  if (sub === "settings") {
    await settings(interaction);
    return true;
  }

  return false;
}
