import { EmbedBuilder } from "discord.js";
import {
  hasPermission,
  getHighestStaffRole,
  loadCases,
  deleteCase,
  revertWarning,
} from "../core.js";

export default async function caseCmd(interaction, sub) {
  if (sub === "view") {
    const number = interaction.options.getInteger("number");
    const user = interaction.options.getUser("user");
    const severity = interaction.options.getString("severity");

    const caseData = await loadCases(interaction.guild.id);
    let cases = caseData.cases;

    if (number) cases = cases.filter(c => c.caseNumber === number);
    if (user) cases = cases.filter(c => c.userId === user.id);
    if (severity) cases = cases.filter(c => c.severity === severity);

    if (!cases.length) {
      return interaction.reply({
        content: "❌ No matching cases found.",
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("📁 Case Results")
      .setDescription(
        cases
          .slice(0, 10)
          .map(
            c =>
              `**#${c.caseNumber}** — ${c.type.toUpperCase()} — ${c.username}\n${c.reason}`
          )
          .join("\n\n")
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === "remove") {
    if (!hasPermission(interaction.member, "deletecase")) {
      const role = getHighestStaffRole(interaction.member);
      return interaction.reply({
        content: `❌ Role **${role?.name ?? "Unknown"}** has no permission.`,
        ephemeral: true,
      });
    }

    const number = interaction.options.getInteger("number");
    const revertWarn = interaction.options.getBoolean("revert_warn") || false;

    const deleted = await deleteCase(interaction.guild.id, number);
    if (!deleted) {
      return interaction.reply({ content: "❌ Case not found.", ephemeral: true });
    }

    if (revertWarn && deleted.type === "warn") {
      await revertWarning(interaction.guild.id, deleted.userId);
    }

    return interaction.reply({
      content: `🗑️ Case #${number} deleted`,
      ephemeral: true,
    });
  }
}
