import { EmbedBuilder } from "discord.js";
import {
  hasPermission,
  getHighestStaffRole,
  addWarning,
  loadWarnings,
  saveWarnings,
  sendLog,
} from "../core.js";

export default async function warn(interaction, sub) {
  if (sub === "add") {
    if (!hasPermission(interaction.member, "warn")) {
      const role = getHighestStaffRole(interaction.member);
      return interaction.reply({ content: `❌ ${role?.name}`, flags: 64, });
    }

    const user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");
    const severity = interaction.options.getString("severity") ?? "moderate";

    const caseNumber = await addWarning(
      interaction.guild.id,
      user.id,
      user.username,
      interaction.user.id,
      interaction.user.tag,
      reason,
      severity
    );

    const embed = new EmbedBuilder()
      .setTitle("⚠️ Warning Issued")
      .setColor(0xffa500)
      .setDescription(`**${user.tag}**\n${reason}`)
      .addFields({ name: "Case", value: `#${caseNumber}` })
      .setTimestamp();

    await sendLog(interaction.guild, embed);
    return interaction.reply({ embeds: [embed], flags: 64, });
  }

  if (sub === "remove") {
    const user = interaction.options.getUser("user");
    const warnings = await loadWarnings(interaction.guild.id);
    const filtered = warnings.filter(w => w.userId !== user.id);

    if (filtered.length === warnings.length) {
      return interaction.reply({ content: "❌ No warnings.", flags: 64, });
    }

    await saveWarnings(interaction.guild.id, filtered);
    return interaction.reply({
      content: `✅ Cleared warnings for ${user.tag}`,
      flags: 64,
    });
  }
}


