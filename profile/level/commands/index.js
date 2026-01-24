import leaderboard from "./leaderboard.js";
import rank from "./rank.js";
import lvlrolesSetup from "./lvlroles-setup.js";
import lvlrolesConfig from "./lvlroles-config.js";

export async function handleLevelCommands(interaction) {
  const cmd = interaction.commandName;

  if (cmd === "leaderboard") return leaderboard(interaction);
  if (cmd === "rank") return rank(interaction);

  if (cmd === "lvlroles") {
    const sub = interaction.options.getSubcommand();
    if (sub === "setup") return lvlrolesSetup(interaction);
    if (sub === "config") return lvlrolesConfig(interaction);
    return true;
  }

  return false;
}
