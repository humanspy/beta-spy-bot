import play from "./play.js";
import pause from "./pause.js";
import stop from "./stop.js";
import queue from "./queue.js";
import current from "./current.js";
import volume from "./volume.js";
import skip from "./skip.js";

export default async function musicCmd(interaction) {
  const sub = interaction.commandName;
  if (cmd === "skip") return skip(interaction);
  if (sub === "play") return play(interaction);
  if (sub === "pause") return pause(interaction);
  if (sub === "stop") return stop(interaction);
  if (sub === "queue") return queue(interaction);
  if (sub === "current") return current(interaction);
  if (sub === "volume") return volume(interaction);
}
