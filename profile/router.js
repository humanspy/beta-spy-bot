import rank from "./level/commands/rank.js";
import leaderboard from "./level/commands/leaderboard.js";
import nick from "./level/commands/nick.js";

export function isProfileCommand(commandName) {
  return [
    "rank",
    "leaderboard",
    "nick",
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

  if (command === "nick") {
    return nick(interaction);
  }

  return false;
}
