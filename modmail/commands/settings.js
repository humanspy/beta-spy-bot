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

  /* ===================== UPDATE ===================== */

  const appealLimit = interaction.options.getInteger("appeal_limit");
  const anonymousSetting = interaction.options.getBoolean("anonymous");
  const hasExplicitUpdates =
    appealLimit !== null || anonymousSetting !== null;

  if (!hasExplicitUpdates) {
    config.anonymousStaff = !config.anonymousStaff;
  }

  if (anonymousSetting !== null) {
    config.anonymousStaff = anonymousSetting;
  }

  if (appealLimit !== null) {
    config.appealLimit = appealLimit;
  }

  await saveModmailConfig(interaction.guild.id, config);

  /* ===================== RESPONSE ===================== */

  const appealText =
    config.appealLimit > 0
      ? `**${config.appealLimit}**`
      : "**Unlimited**";

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(config.anonymousStaff ? 0x57f287 : 0xfaa61a)
        .setTitle("⚙️ ModMail Settings Updated")
        .setDescription(
          `Anonymous staff replies are now **${
            config.anonymousStaff ? "ENABLED" : "DISABLED"
          }**.\n` +
          `Ban appeal limit: ${appealText}\n\n` +
          (config.anonymousStaff
            ? "Users will see replies as coming from **Staff**."
            : "Users will see the **staff member’s username**.")
        ),
    ],
    flags: 64,
  });
}
