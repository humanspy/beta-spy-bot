export default async function lvlrolesSetup(interaction) {
  await interaction.reply({
    content: "⚠️ The level roles wizard has been removed.",
    ephemeral: true,
  });
}
