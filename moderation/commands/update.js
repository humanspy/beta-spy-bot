import { EmbedBuilder, PermissionFlagsBits, REST, Routes } from "discord.js";
import { guildCommands } from "../../guild-commands.js";
import {
  getInviteSyncCommandDefinition,
  shouldIncludeInviteSyncCommand,
} from "../../invite-handler/index.js";
import {
  getAnnouncementSyncCommandDefinition,
  shouldIncludeAnnouncementSyncCommand,
} from "../../announcement-handler/index.js";
import { hasPermission } from "../core.js";

async function canUpdate(interaction) {
  return (
    interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
    (await hasPermission(interaction.member, "setup"))
  );
}

export default async function update(interaction) {
  if (!(await canUpdate(interaction))) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ Missing Permission")
          .setDescription("You do not have permission to update commands."),
      ],
      flags: 64,
    });
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🔄 Updating Commands")
        .setDescription("Refreshing guild slash commands..."),
    ],
    flags: 64,
  });

  const rest = new REST({ version: "10" }).setToken(
    process.env.DISCORD_BOT_TOKEN
  );

  try {
    const commands = [...guildCommands];
    if (shouldIncludeInviteSyncCommand(interaction.guild.id)) {
      commands.push(getInviteSyncCommandDefinition());
    }
    if (shouldIncludeAnnouncementSyncCommand(interaction.guild.id)) {
      commands.push(getAnnouncementSyncCommandDefinition());
    }
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID,
        interaction.guild.id
      ),
      { body: commands }
    );

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle("✅ Commands Updated")
          .setDescription("Guild commands have been refreshed."),
      ],
    });
  } catch (err) {
    console.error("❌ Failed to update guild commands:", err);
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ Update Failed")
          .setDescription("Could not refresh guild commands."),
      ],
    });
  }
}
