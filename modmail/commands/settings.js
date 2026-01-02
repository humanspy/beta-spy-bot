import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { loadModmailConfig, saveModmailConfig } from "../config.js";

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

  /* ===================== TOGGLE ===================== */

  config.anonymousStaff = !config.anonymousStaff;
  await saveModmailConfig(interaction.guild.id, config);

  /* ===================== RESPONSE ===================== */

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(config.anonymousStaff ? 0x57f287 : 0xfaa61a)
        .setTitle("⚙️ ModMail Settings Updated")
        .setDescription(
          `Anonymous staff replies are now **${
            config.anonymousStaff ? "ENABLED" : "DISABLED"
          }**.\n\n` +
          (config.anonymousStaff
            ? "Users will see replies as coming from **Staff**."
            : "Users will see the **staff member’s username**.")
        ),
    ],
    flags: 64,
  });
}
