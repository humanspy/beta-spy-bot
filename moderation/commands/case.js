import {
  hasPermission,
  loadCaseByNumber,
  loadCasesForUser,
  deleteCase,
  logModerationAction,
} from "../core.js";
import { EmbedBuilder } from "discord.js";

export async function caseCmd(interaction, sub) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!(await hasPermission(interaction.member, "case"))) {
      return interaction.editReply("❌ No permission.");
    }

    const guildId = interaction.guild.id;
    const guildName = interaction.guild.name;

    if (sub === "view") {
      const number = interaction.options.getInteger("number");
      const user = interaction.options.getUser("user");

      if (!number && !user) {
        return interaction.editReply("❌ Provide a case number or user.");
      }

      if (number) {
        const c = await loadCaseByNumber(guildId, guildName, number);
        if (!c) return interaction.editReply("❌ Case not found.");

        const embed = new EmbedBuilder()
          .setTitle(`📁 Case #${c.case_number}`)
          .setColor(0x3498db)
          .addFields(
            { name: "User", value: `<@${c.user_id}>` },
            { name: "Type", value: c.type },
            { name: "Reason", value: c.reason }
          )
          .setTimestamp(new Date(c.created_at));

        return interaction.editReply({ embeds: [embed] });
      }

      const cases = await loadCasesForUser(guildId, guildName, user.id);
      if (!cases.length) {
        return interaction.editReply("ℹ️ No cases found.");
      }

      const embed = new EmbedBuilder()
        .setTitle(`📁 Cases for ${user.tag}`)
        .setColor(0x3498db)
        .setDescription(
          cases
            .map(
              c =>
                `**#${c.case_number}** | ${c.type}\n${c.reason}`
            )
            .join("\n\n")
        );

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === "remove") {
      const number = interaction.options.getInteger("number");
      if (!number) return interaction.editReply("❌ Case number required.");

      const ok = await deleteCase(guildId, guildName, number);
      if (!ok) return interaction.editReply("❌ Case not found.");

      await logModerationAction({
        guild: interaction.guild,
        actor: interaction.user,
        actorMember: interaction.member,
        action: "🗑️ Case Removed",
        target: `Case #${number}`,
        reason: "Case removed via command",
        color: 0x95a5a6,
      });

      return interaction.editReply(`🗑️ Case **#${number}** removed.`);
    }

    return interaction.editReply("❌ Invalid subcommand.");
  } catch {
    return interaction.editReply("❌ Failed to manage cases.");
  }
}

export default caseCmd;
