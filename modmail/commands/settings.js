import {
  ActionRowBuilder,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { loadModmailConfig } from "../config.js";

export default async function modmailSettings(interaction) {
  if (
    !interaction.memberPermissions.has(
      PermissionFlagsBits.Administrator
    )
  ) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ Missing Permission")
          .setDescription(
            "Administrator permission is required to modify ModMail settings."
          ),
      ],
      flags: 64,
    });
  }

  const config = await loadModmailConfig(interaction.guild.id);

  if (!config) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ ModMail Not Configured")
          .setDescription(
            "ModMail is not set up yet.\n\nUse `/modmail setup` first."
          ),
      ],
      flags: 64,
    });
  }

  /* ===================== MODAL ===================== */

  const modal = new ModalBuilder()
    .setCustomId("modmail_settings_modal")
    .setTitle("ModMail Settings");

  const anonymousInput = new TextInputBuilder()
    .setCustomId("modmail_settings_anonymous")
    .setLabel("Anonymous staff replies (enabled/disabled)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(config.anonymousStaff ? "enabled" : "disabled");

  const appealInput = new TextInputBuilder()
    .setCustomId("modmail_settings_appeal")
    .setLabel("Ban Appeal Limit (0 = unlimited)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setValue(String(config.appealLimit ?? 0));

  modal.addComponents(
    new ActionRowBuilder().addComponents(anonymousInput),
    new ActionRowBuilder().addComponents(appealInput)
  );

  await interaction.showModal(modal);
}
