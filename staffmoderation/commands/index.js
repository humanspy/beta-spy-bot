import staffwarn from "./staffwarn.js";
import promotion from "./promotion.js";
import demotion from "./demotion.js";

export async function handleStaffModeration(interaction) {
  const command = interaction.commandName;
  const sub = interaction.options.getSubcommand(false);

  if (command === "staffwarn") return staffwarn(interaction, sub);
  if (command === "promote") return promotion(interaction);
  if (command === "demote") return demotion(interaction);

  return false;
}
