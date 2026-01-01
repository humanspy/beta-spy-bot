import { Player } from "discord-player";
import { EmbedBuilder } from "discord.js";

const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export function setupPlayer(client) {
  /* ===================== PLAYER INIT ===================== */

  const player = new Player(client, {
    ytdlOptions: {
      quality: "highestaudio",
      highWaterMark: 1 << 25,
    },
  });

  /* ===================== EXTRACTORS ===================== */
  // REQUIRED: without this, search + URLs will silently fail
  player.extractors.loadDefault({
    defaultSearchEngine: "youtube",
  });

  console.log(
    "🎵 Loaded extractors:",
    player.extractors.store.map(e => e.name).join(", ")
  );

  /* ===================== ERROR HANDLING ===================== */

  player.events.on("error", (queue, error) => {
    console.error(
      `❌ Queue error in ${queue.guild?.name ?? "unknown guild"}:`,
      error
    );
  });

  player.events.on("playerError", (queue, error) => {
    console.error(
      `❌ Player error in ${queue.guild?.name ?? "unknown guild"}:`,
      error
    );
  });

  /* ===================== AUTO DISCONNECT ===================== */

  player.events.on("emptyQueue", queue => {
    setTimeout(() => {
      if (!queue.node.isPlaying()) {
        console.log(`🔌 Leaving VC in ${queue.guild?.name}`);
        queue.delete();
      }
    }, IDLE_TIMEOUT);
  });

  /* ===================== NOW PLAYING EMBED ===================== */

  player.events.on("playerStart", (queue, track) => {
    const channel = queue.metadata;
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0x1db954)
      .setTitle("🎵 Now Playing")
      .setDescription(`**${track.title}**`)
      .setThumbnail(track.thumbnail)
      .addFields(
        { name: "Artist", value: track.author || "Unknown", inline: true },
        { name: "Duration", value: track.duration || "Unknown", inline: true },
        {
          name: "Requested by",
          value: track.requestedBy?.tag || "Unknown",
          inline: true,
        },
        {
          name: "Source",
          value: track.source || "Unknown",
          inline: true,
        }
      )
      .setTimestamp();

    channel.send({ embeds: [embed] }).catch(() => {});
  });

  /* ===================== FINALIZE ===================== */

  client.player = player;
  return player;
}
