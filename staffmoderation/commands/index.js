import staffwarn from "./staffwarn.js";

export async function handleStaffModeration(interaction) {
  const command = interaction.commandName;
  const sub = interaction.options.getSubcommand(false);

  if (command === "staffwarn") return staffwarn(interaction, sub);

  return false;
}
