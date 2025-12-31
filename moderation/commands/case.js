import { EmbedBuilder } from "discord.js";
import {
  hasPermission,
  getHighestStaffRole,
  loadCases,
  deleteCase,
} from "../core.js";

export default async function caseCmd(interaction, sub) {
  if (sub === "view") {
    const data = await loadCases(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setTitle("📁 Cases")
      .setColor(0x3498db)
      .setDescription(
        data.cases
          .slice(-10)
          .map(c => `#${c.caseNumber} • ${c.type} • ${c.username}`)
          .join("\n")
      );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === "remove") {
    if (!hasPermission(interaction.member, "deletecase")) {
      const role = getHighestStaffRole(interaction.member);
      return interaction.reply({ content: `❌ ${role?.name}`, ephemeral: true });
    }

    const number = interaction.options.getInteger("number");
    const ok = await deleteCase(interaction.guild.id, number);
    if (!ok) return interaction.reply({ content: "❌ Not found", ephemeral: true });

    return interaction.reply({ content: `🗑️ Case #${number} deleted`, ephemeral: true });
  }
}
