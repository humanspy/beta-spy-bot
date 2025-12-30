import { loadModmailConfig, saveModmailConfig } from "../config.js";

export default async function modmailSettings(interaction) {
  const config = await loadModmailConfig(interaction.guild.id);

  if (!config) {
    return interaction.reply({
      content: "❌ ModMail is not set up yet. Use `/modmail setup` first.",
      ephemeral: true,
    });
  }

  config.anonymousStaff = !config.anonymousStaff;
  await saveModmailConfig(interaction.guild.id, config);

  await interaction.reply({
    content: `🔧 Anonymous staff mode is now **${config.anonymousStaff ? "ON" : "OFF"}**`,
    ephemeral: true,
  });
}
