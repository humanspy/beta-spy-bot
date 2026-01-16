import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { lvlrolesWizard } from "../lvlrolesWizard.js";

export default async function lvlrolesSetup(interaction) {
  lvlrolesWizard.set(interaction.guild.id, {
    userId: interaction.user.id,
    step: "interval",
    interval: null,
    currentLevel: 1,
    roles: {},
  });

  const embed = new EmbedBuilder()
    .setTitle("Level Roles Setup")
    .setDescription(
      "Let’s configure **level-based roles**.\n\n" +
      "**Step 1:** Choose the level interval.\n" +
      "Example: interval `10` → roles at level 1, 10, 20, 30..."
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("lvlroles_interval")
      .setLabel("Set Interval")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("lvlroles_cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}
