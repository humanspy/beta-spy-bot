import { EmbedBuilder } from "discord.js";
import {
  hasPermission,
  getHighestStaffRole,
  createCase,
  validateAndUseOverrideCode,
  sendLog,
} from "../core.js";

export default async function ban(interaction, sub) {
  if (sub === "add") {
    if (!hasPermission(interaction.member, "ban")) {
      const role = getHighestStaffRole(interaction.member);
      return interaction.reply({ content: `❌ ${role?.name}`, ephemeral: true });
    }

    const target = interaction.options.getString("target").match(/\d+/)?.[0];
    if (!target) return interaction.reply({ content: "❌ Invalid user", ephemeral: true });

    const reason = interaction.options.getString("reason");
    const override = interaction.options.getString("override_code");

    if (override && !(await validateAndUseOverrideCode(override, interaction.user.id))) {
      return interaction.reply({ content: "❌ Invalid override", ephemeral: true });
    }

    await interaction.guild.members.ban(target, { reason });

    const caseNumber = await createCase(
      interaction.guild.id,
      "BAN",
      target,
      target,
      interaction.user.id,
      interaction.user.tag,
      reason
    );

    const embed = new EmbedBuilder()
      .setTitle("🔨 User Banned")
      .setColor(0xe74c3c)
      .addFields({ name: "Case", value: `#${caseNumber}` })
      .setTimestamp();

    await sendLog(interaction.guild, embed);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
