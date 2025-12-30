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
      return interaction.reply({
        content: `❌ Role **${role?.name ?? "Unknown"}** has no permission.`,
        ephemeral: true,
      });
    }

    const targetInput = interaction.options.getString("target");
    const reason = interaction.options.getString("reason");
    const overrideCode = interaction.options.getString("override_code");
    const deleteDays = interaction.options.getInteger("delete_days") || 0;
    const isHackban = interaction.options.getBoolean("hackban") || false;

    const idMatch = targetInput.match(/\d+/);
    if (!idMatch) {
      return interaction.reply({ content: "❌ Invalid user.", ephemeral: true });
    }

    const userId = idMatch[0];
    let usedOverride = false;

    if (overrideCode) {
      const codeData = await validateAndUseOverrideCode(
        overrideCode,
        interaction.user.id
      );
      if (!codeData) {
        return interaction.reply({
          content: "❌ Invalid override code.",
          ephemeral: true,
        });
      }
      usedOverride = true;
    }

    await interaction.guild.members.ban(userId, {
      reason,
      deleteMessageSeconds: deleteDays * 86400,
    });

    const caseNumber = await createCase(
      interaction.guild.id,
      isHackban ? "hackban" : "ban",
      userId,
      userId,
      interaction.user.id,
      interaction.user.tag,
      reason,
      null,
      deleteDays
    );

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🔨 User Banned")
      .addFields(
        { name: "User ID", value: userId, inline: true },
        { name: "Reason", value: reason },
        { name: "Case #", value: `#${caseNumber}`, inline: true }
      )
      .setTimestamp();

    if (usedOverride) {
      embed.addFields({ name: "Override Code", value: "Used", inline: true });
    }

    await sendLog(interaction.guild, embed, interaction.user.id);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === "remove") {
    const userId = interaction.options.getString("user_id");
    const reason = interaction.options.getString("reason") || "No reason provided";

    await interaction.guild.members.unban(userId, reason);

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("✅ User Unbanned")
      .addFields(
        { name: "User ID", value: userId, inline: true },
        { name: "Reason", value: reason }
      )
      .setTimestamp();

    await sendLog(interaction.guild, embed, interaction.user.id);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
