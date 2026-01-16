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

    if (sub === "remove" || sub === "delete") {
      const number = interaction.options.getInteger("number");
      if (!number) return interaction.editReply("❌ Case number required.");

      const existingCase = await loadCaseByNumber(
        guildId,
        guildName,
        number
      );
      if (!existingCase) return interaction.editReply("❌ Case not found.");

      const ok = await deleteCase(guildId, guildName, number);
      if (!ok) return interaction.editReply("❌ Case not found.");

      const affectedUser = await interaction.client.users
        .fetch(existingCase.user_id)
        .catch(() => null);
      if (affectedUser) {
        try {
          const dmEmbed = new EmbedBuilder()
            .setColor(0x95a5a6)
            .setTitle("🗑️ Moderation Case Removed")
            .setDescription(
              `A moderation case (#${number}) was removed from **${interaction.guild.name}**.`
            )
            .addFields(
              { name: "Case Type", value: existingCase.type },
              { name: "Reason", value: existingCase.reason }
            )
            .setTimestamp();
          await affectedUser.send({ embeds: [dmEmbed] });
        } catch {
          // user DMs closed
        }
      }

      await logModerationAction({
        guild: interaction.guild,
        actor: interaction.user,
        actorMember: interaction.member,
        action: "🗑️ Case Removed",
        target: `<@${existingCase.user_id}> (${
          existingCase.username ?? existingCase.user_id
        })`,
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
