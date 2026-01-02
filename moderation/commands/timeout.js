import { hasPermission } from "../permissions.js";
import { parseDuration } from "../utils/time.js";

export default async function timeout(interaction, sub) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!hasPermission(interaction.member, "timeout")) {
      return interaction.editReply("❌ You do not have permission to timeout users.");
    }

    const member = interaction.options.getMember("user");
    if (!member) {
      return interaction.editReply("❌ User not found in this server.");
    }

    if (sub === "add") {
      const durationRaw = interaction.options.getString("duration");
      const reason = interaction.options.getString("reason");

      const durationMs = parseDuration(durationRaw);
      if (!durationMs) {
        return interaction.editReply("❌ Invalid duration.");
      }

      await member.timeout(durationMs, reason);

      return interaction.editReply(
        `⏱️ **${member.user.tag}** has been timed out.\nReason: ${reason}`
      );
    }

    if (sub === "remove") {
      const reason = interaction.options.getString("reason") ?? "Timeout removed";

      await member.timeout(null, reason);

      return interaction.editReply(`✅ Timeout removed for **${member.user.tag}**.`);
    }

  } catch (err) {
    console.error("[TIMEOUT]", err);
    return interaction.editReply("❌ Failed to execute timeout command.");
  }
}
