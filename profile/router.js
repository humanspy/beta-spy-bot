import rank from "./level/commands/rank.js";
import leaderboard from "./level/commands/leaderboard.js";
import lvlrolesSetup from "./level/commands/lvlroles-setup.js";
import lvlrolesConfig from "./level/commands/lvlroles-config.js";

export function isProfileCommand(commandName) {
  return [
    "rank",
    "leaderboard",
    "lvlroles",
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

  if (command === "lvlroles") {
    const sub = interaction.options.getSubcommand();

    if (sub === "setup") {
      return lvlrolesSetup(interaction);
    }

    if (sub === "config") {
      return lvlrolesConfig(interaction);
    }
  }

  return false;
}
