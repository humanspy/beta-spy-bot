import { Player } from "discord-player";
import { EmbedBuilder } from "discord.js";

import {
  YouTubeExtractor,
  SpotifyExtractor,
  SoundCloudExtractor,
  AppleMusicExtractor,
  DeezerExtractor
} import { Player } from "discord-player";


const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export function setupPlayer(client) {
  const player = new Player(client, {
    ytdlOptions: {
      quality: "highestaudio",
      highWaterMark: 1 << 25
    }
  });

  player.extractors.register(YouTubeExtractor, {});
  player.extractors.register(SpotifyExtractor, {});
  player.extractors.register(SoundCloudExtractor, {});
  player.extractors.register(AppleMusicExtractor, {});
  player.extractors.register(DeezerExtractor, {}); // ✅ ADD THIS

  player.events.on("error", (queue, error) => {
    console.error(`Queue error in ${queue.guild.name}`, error);
  });

  player.events.on("playerError", (queue, error) => {
    console.error(`Player error in ${queue.guild.name}`, error);
  });
  
  player.events.on("emptyQueue", queue => {
  setTimeout(() => {
    if (!queue.node.isPlaying()) {
      queue.delete();
    }
  }, IDLE_TIMEOUT);
});

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
      { name: "Duration", value: track.duration, inline: true },
      { name: "Requested by", value: track.requestedBy?.tag || "Unknown", inline: true }
    )
    .setTimestamp();

  channel.send({ embeds: [embed] }).catch(() => {});
});


  return player;
}
