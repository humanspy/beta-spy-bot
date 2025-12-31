import { musicCmd } from "./cmds/index.js";

export async function handleMusic(interaction) {
  return musicCmd(interaction);
}
