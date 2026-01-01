import warn from "./warn.js";
import timeout from "./timeout.js";
import ban from "./ban.js";
import caseCmd from "./case.js";
import purge from "./purge.js";
import help from "./help.js";
import generatebancode from "./generatebancode.js";
import setup from "./setup.js";

export async function handleModeration(interaction) {
  const command = interaction.commandName;

  if (command === "warn") return warn(interaction);
  if (command === "timeout") return timeout(interaction);
  if (command === "ban") return ban(interaction);
  if (command === "case") return caseCmd(interaction);
  if (command === "purge") return purge(interaction);
  if (command === "help") return help(interaction);
  if (command === "generatebancode") return generatebancode(interaction);
  if (command === "setup") return setup.execute(interaction);

  return false;
}

