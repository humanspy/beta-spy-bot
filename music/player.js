import { Player } from "discord-player";
import { EmbedBuilder } from "discord.js";
import { YoutubeiExtractor } from "discord-player-youtubei";

const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export function setupPlayer(client) {
  /* ===================== PLAYER INIT ===================== */

  const player = new Player(client, {
    skipFFmpeg: false,      // REQUIRED for youtubei
    probeTimeout: 20000,    // Prevent AbortError on cold starts
    lagMonitor: 30000,      // Railway-friendly
  });

  /* ===================== REQUIRED RAW ERROR LISTENERS ===================== */

  // Core player errors (MANDATORY in v6.7+)
  player.on("error", err => {
    console.error("❌ Discord-Player internal error:", err);
  });

  // Extractor-level errors (MANDATORY)
  player.extractors.on("error", err => {
    console.error("❌ Extractor error:", err);
  });

  /* ===================== EXTRACTORS ===================== */

  // Register YouTubei FIRST
  player.extractors.register(YoutubeiExtractor, {
    streamOptions: {
      quality: "highestaudio",
    },
  });

  // Load remaining default extractors (Spotify, SoundCloud, etc.)
  player.extractors.loadDefault();

  console.log(
    "🎵 Loaded extractors:",
    player.extractors.store.map(e => e.name).join(", ")
  );

  /* ===================== QUEUE / PLAYER EVENTS ===================== */

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

  /* ===================== PLAYLIST EVENTS ===================== */

  player.events.on("playlistAdd", (queue, playlist) => {
    const channel = queue.metadata;
    if (!channel?.send) return;

    const embed = new EmbedBuilder()
      .setColor(0x1db954)
      .setTitle("📃 Playlist Added")
      .setDescription(`**${playlist.title}**`)
      .addFields(
        { name: "Tracks", value: `${playlist.tracks.length}`, inline: true },
        { name: "Source", value: playlist.source || "Unknown", inline: true },
        {
          name: "Requested by",
          value: playlist.requestedBy?.tag || "Unknown",
          inline: true,
        }
      )
      .setThumbnail(playlist.thumbnail)
      .setTimestamp();

    channel.send({ embeds: [embed] }).catch(() => {});
  });

  player.events.on("playlistStart", (queue, playlist) => {
    const channel = queue.metadata;
    if (!channel?.send) return;

    channel
      .send(
        `▶️ **Started playlist:** **${playlist.title}** (${playlist.tracks.length} tracks)`
      )
      .catch(() => {});
  });

  /* ===================== NOW PLAYING ===================== */

  player.events.on("playerStart", (queue, track) => {
    const channel = queue.metadata;
    if (!channel?.send) return;

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
