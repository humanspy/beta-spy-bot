import { EmbedBuilder } from "discord.js";
import {
  hasPermission,
  getHighestStaffRole,
  createCase,
  validateAndUseOverrideCode,
  sendLog,
} from "../core.js";

export default async function ban(interaction, sub) {
  if (sub !== "add") return;

  if (!hasPermission(interaction.member, "ban")) {
    const role = getHighestStaffRole(interaction.member);
    return interaction.reply({
      content: `❌ ${role?.name}`,
      flags: 64,
    });
  }

  const targetId = interaction.options.getString("target")?.match(/\d+/)?.[0];
  if (!targetId) {
    return interaction.reply({
      content: "❌ Invalid user",
      flags: 64,
    });
  }

  const reason = interaction.options.getString("reason") || "No reason provided";
  const override = interaction.options.getString("override_code");

  if (override && !(await validateAndUseOverrideCode(override, interaction.user.id))) {
    return interaction.reply({
      content: "❌ Invalid override",
      flags: 64,
    });
  }

  /* ===================== DM BAN NOTICE ===================== */

  try {
    const user = await interaction.client.users.fetch(targetId);

    const dmEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle(`You have been banned from ${interaction.guild.name}`)
      .setDescription(
        `**Reason:** ${reason}\n\n` +
        `If you believe this ban was a mistake, you may **appeal by replying to this DM**.\n\n` +
        `Please explain your situation clearly and respectfully.`
      )
      .setFooter({ text: "Ban Appeal System" })
      .setTimestamp();

    await user.send({ embeds: [dmEmbed] });
  } catch {
    // User has DMs closed or blocked the bot — ignore
  }

  /* ===================== EXECUTE BAN ===================== */

  await interaction.guild.members.ban(targetId, { reason });

  /* ===================== CASE CREATION ===================== */

  const caseNumber = await createCase(
    interaction.guild.id,
    "BAN",
    targetId,
    targetId,
    interaction.user.id,
    interaction.user.tag,
    reason
  );

  /* ===================== LOGGING ===================== */

  const embed = new EmbedBuilder()
    .setTitle("🔨 User Banned")
    .setColor(0xe74c3c)
    .addFields(
      { name: "User ID", value: targetId, inline: true },
      { name: "Moderator", value: interaction.user.tag, inline: true },
      { name: "Case", value: `#${caseNumber}`, inline: true },
      { name: "Reason", value: reason }
    )
    .setTimestamp();

  await sendLog(interaction.guild, embed);

  return interaction.reply({
    embeds: [embed],
    flags: 64,
  });
}
