import staffwarn from "./staffwarn.js";
import promotion from "./promotion.js";
import demotion from "./demotion.js";

export async function handleStaffModeration(interaction) {
  const command = interaction.commandName;
  const sub = interaction.options.getSubcommand(false);

  if (command === "staffwarn") return staffwarn(interaction, sub);
  if (command === "promotion") return promotion(interaction, sub);
  if (command === "demotion") return demotion(interaction, sub);

  return false;
}
