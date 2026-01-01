import play from "./play.js";
import pause from "./pause.js";
import stop from "./stop.js";
import skip from "./skip.js";
import queue from "./queue.js";
import current from "./current.js";
import volume from "./volume.js";

export async function handleMusic(interaction) {
  if (interaction.commandName !== "music") return false;

  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case "play":
      await play(interaction);
      break;
    case "pause":
      await pause(interaction);
      break;
    case "stop":
      await stop(interaction);
      break;
    case "skip":
      await skip(interaction);
      break;
    case "queue":
      await queue(interaction);
      break;
    case "current":
      await current(interaction);
      break;
    case "volume":
      await volume(interaction);
      break;
  }

  return true;
}
