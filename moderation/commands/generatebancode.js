import { generateBanOverrideCode, hasPermission } from "../core.js";

export default async function generatebancode(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!hasPermission(interaction.member, "ban")) {
      return interaction.editReply("❌ No permission.");
    }

    const code = await generateBanOverrideCode(
      interaction.user.tag,
      interaction.user.id
    );

    return interaction.editReply(`🔑 Override code generated:\n\`${code}\``);
  } catch {
    return interaction.editReply("❌ Failed to generate override code.");
  }
}
