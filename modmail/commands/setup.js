import {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
} from "discord.js";
import { saveModmailConfig } from "../config.js";

export default async function modmailSetup(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: "❌ You need Administrator permissions to set up ModMail.",
      ephemeral: true,
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId("modmail_forum_select")
      .setPlaceholder("Select the forum channel for ModMail tickets")
      .addChannelTypes(ChannelType.GuildForum)
  );

  await interaction.reply({
    content: "📁 **Select the forum channel to use for ModMail tickets**",
    components: [row],
    ephemeral: true,
  });
}
