import { getGuildVolume } from "../storage/volume.js";
export default async function play(interaction) {
  const query = interaction.options.getString("query");
  const voiceChannel = interaction.member.voice.channel;

  if (!voiceChannel) {
    return interaction.reply({
      content: "❌ You must be in a voice channel.",
      ephemeral: true
    });
  }

  await interaction.deferReply();

  const player = interaction.client.player;
  const queue = player.nodes.create(interaction.guild, {
    metadata: interaction.channel
  });

  try {
    if (!queue.connection) {
      await queue.connect(voiceChannel);
    }

    const result = await player.search(query, {
      requestedBy: interaction.user
    });

    if (!result.tracks.length) {
      return interaction.editReply("❌ No results found.");
    }

    queue.addTrack(result.tracks[0]);
	queue.node.setVolume(getGuildVolume(interaction.guild.id));

    if (!queue.isPlaying()) {
      await queue.node.play();
    }

    return interaction.editReply(
      `🎵 **Now Playing:** ${result.tracks[0].title}`
    );

  } catch (err) {
    console.error(err);
    return interaction.editReply("❌ Playback error.");
  }
}
