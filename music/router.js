import { handleMusicCommand } from "./cmds/index.js";

export function isMusicCommand(commandName) {
  return [
    "play",
    "pause",
    "stop",
	"skip",
    "queue",
    "current",
    "volume"
  ].includes(commandName);
}

export async function handleMusic(interaction) {
  return handleMusicCommand(interaction);
}
