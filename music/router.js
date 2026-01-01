import { handleMusic as musicHandler } from "./cmds/index.js";

export async function handleMusic(interaction) {
  return musicHandler(interaction);
}
