import staffwarn from "./staffwarn.js";
import promo from "./promo.js";
import demote from "./demote.js";

export async function handleStaffModeration(interaction) {
  const command = interaction.commandName;
  const sub = interaction.options.getSubcommand(false);

  if (command === "staffwarn") return staffwarn(interaction, sub);
  if (command === "promo") return promo(interaction);
  if (command === "demote") return demote(interaction);

  return false;
}
