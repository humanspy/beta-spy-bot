import rank from "./level/commands/rank.js";
import leaderboard from "./level/commands/leaderboard.js";

export function isProfileCommand(commandName) {
  return [
    "rank",
    "leaderboard",
  ].includes(commandName);
}

export async function handleProfile(interaction) {
  const command = interaction.commandName;

  if (command === "rank") {
    return rank(interaction);
  }

  if (command === "leaderboard") {
    return leaderboard(interaction);
  }

  return false;
}
