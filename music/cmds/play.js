import { QueryType } from "discord-player";
import { getGuildVolume } from "../storage/volume.js";

export default async function play(interaction) {
  const query = interaction.options.getString("query");
  const voiceChannel = interaction.member.voice.channel;

  if (!voiceChannel) {
    return interaction.reply({
      content: "❌ You must be in a voice channel.",
      flags: 64,
    });
  }

  await interaction.deferReply();

  const player = interaction.client.player;
  const queue =
    player.nodes.get(interaction.guild.id) ??
    player.nodes.create(interaction.guild, {
      metadata: interaction.channel,
    });

  try {
    if (!queue.connection) {
      await queue.connect(voiceChannel);
    }

    await queue.node.play();
    
    let result;

    /* ===================== FAST PATH ===================== */
    // URLs: skip search entirely
    if (/^https?:\/\//.test(query)) {
      result = await player.search(query, {
        requestedBy: interaction.user,
        searchEngine: QueryType.AUTO,
      });
    } 
    /* ===================== TEXT SEARCH ===================== */
    else {
      result = await player.search(query, {
        requestedBy: interaction.user,
        searchEngine: QueryType.YOUTUBE_SEARCH,
      });
    }

    if (!result?.tracks?.length) {
      return interaction.editReply("❌ No results found.");
    }

    const track = result.tracks[0];
    queue.addTrack(track);

    queue.node.setVolume(getGuildVolume(interaction.guild.id));

    if (!queue.isPlaying()) {
      await queue.node.play();
    }

    return interaction.editReply(`🎵 **Now Playing:** ${track.title}`);
  } catch (err) {
    console.error("Playback error:", err);
    return interaction.editReply("❌ Playback error.");
  }
}

