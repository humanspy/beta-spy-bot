import leaderboard from "./leaderboard.js";
import rank from "./rank.js";

export async function handleLevelCommands(interaction) {
  const cmd = interaction.commandName;

  if (cmd === "leaderboard") return leaderboard(interaction);
  if (cmd === "rank") return rank(interaction);

  return false;
}
