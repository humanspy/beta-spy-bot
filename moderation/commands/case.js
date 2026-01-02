import { hasPermission } from "../permissions.js";
import { loadCases, deleteCase } from "../core.js";

export default async function caseCmd(interaction, sub) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!hasPermission(interaction.member, "case")) {
      return interaction.editReply("❌ You do not have permission to manage cases.");
    }

    if (sub === "view") {
      const number = interaction.options.getInteger("number");
      const user = interaction.options.getUser("user");

      const data = await loadCases(interaction.guild.id);
      let cases = data.cases;

      if (number) cases = cases.filter(c => c.caseNumber === number);
      if (user) cases = cases.filter(c => c.userId === user.id);

      if (!cases.length) {
        return interaction.editReply("ℹ️ No cases found.");
      }

      return interaction.editReply(
        cases
          .map(c => `#${c.caseNumber} | ${c.type} | ${c.username} | ${c.reason ?? "—"}`)
          .join("\n")
      );
    }

    if (sub === "remove") {
      const number = interaction.options.getInteger("number");

      await deleteCase(interaction.guild.id, number);

      return interaction.editReply(`🗑️ Case **#${number}** deleted.`);
    }

  } catch (err) {
    console.error("[CASE]", err);
    return interaction.editReply("❌ Failed to execute case command.");
  }
}
