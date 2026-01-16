import warn from "./warn.js";
import timeout from "./timeout.js";
import ban from "./ban.js";
import caseCmd from "./case.js";
import purge from "./purge.js";
import help from "./help.js";
import generatebancode from "./generatebancode.js";
import setup from "./setup.js";
import kick from "./kick.js";
import staffwarn from "./staffwarn.js";
import update from "./update.js";

export async function handleModeration(interaction) {
  const command = interaction.commandName;
  const sub = interaction.options.getSubcommand(false);

  if (command === "warn") return warn(interaction, sub);
  if (command === "timeout") return timeout(interaction, sub);
  if (command === "ban") return ban(interaction, sub);
  if (command === "case") return caseCmd(interaction, sub);
  if (command === "purge") return purge(interaction);
  if (command === "kick") return kick(interaction);
  if (command === "help") return help(interaction);
  if (command === "generatebancode") return generatebancode(interaction);
  if (command === "staffwarn") return staffwarn(interaction, sub);
  if (command === "setup") return setup.execute(interaction);
  if (command === "update") return update(interaction);

  return false;
}

