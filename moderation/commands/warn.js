import { EmbedBuilder } from "discord.js";
import {
  hasPermission,
  getHighestStaffRole,
  createCase,
  addWarning,
  loadWarnings,
  saveWarnings,
  sendLog,
} from "../core.js";

export default async function warn(interaction, sub) {
  if (sub === "add") {
    if (!hasPermission(interaction.member, "warn")) {
      const role = getHighestStaffRole(interaction.member);
      return interaction.reply({
        content: `❌ Role **${role?.name ?? "Unknown"}** has no permission.`,
        ephemeral: true,
      });
    }

    const targetUser = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");
    const severity = interaction.options.getString("severity") || "moderate";
    const silent = interaction.options.getBoolean("silent") || false;

    const count = await addWarning(
      interaction.guild.id,
      targetUser.id,
      targetUser.username,
      reason,
      severity
    );

    const caseNumber = await createCase(
      interaction.guild.id,
      "warn",
      targetUser.id,
      targetUser.username,
      interaction.user.id,
      interaction.user.tag,
      reason,
      severity
    );

    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle("⚠️ Warning Issued")
      .addFields(
        { name: "User", value: targetUser.tag, inline: true },
        { name: "Reason", value: reason },
        { name: "Severity", value: severity.toUpperCase(), inline: true },
        { name: "Case #", value: `#${caseNumber}`, inline: true },
        { name: "Total Warnings", value: `${count}`, inline: true }
      )
      .setTimestamp();

    if (!silent) {
      try {
        await targetUser.send({ embeds: [embed] });
      } catch {}
    }

    await sendLog(interaction.guild, embed, interaction.user.id);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === "remove") {
    const targetUser = interaction.options.getUser("user");
    const warnings = await loadWarnings(interaction.guild.id);

    if (!warnings[targetUser.id]) {
      return interaction.reply({
        content: "❌ User has no warnings.",
        ephemeral: true,
      });
    }

    delete warnings[targetUser.id];
    await saveWarnings(interaction.guild.id, warnings);

    return interaction.reply({
      content: `✅ All warnings cleared for **${targetUser.tag}**`,
      ephemeral: true,
    });
  }
}
