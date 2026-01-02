import { hasPermission } from "../permissions.js";
import { addWarning } from "../core.js";

export default async function warn(interaction, sub) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!hasPermission(interaction.member, "warn")) {
      return interaction.editReply("❌ You do not have permission to warn users.");
    }

    if (sub === "add") {
      const user = interaction.options.getUser("user");
      const reason = interaction.options.getString("reason");
      const severity = interaction.options.getString("severity") ?? "moderate";
      const silent = interaction.options.getBoolean("silent") ?? false;

      await addWarning({
        guild: interaction.guild,
        moderator: interaction.user,
        target: user,
        reason,
        severity,
        silent,
      });

      return interaction.editReply(`✅ **${user.tag}** has been warned.`);
    }

    if (sub === "remove") {
      const user = interaction.options.getUser("user");

      await addWarning({
        guild: interaction.guild,
        moderator: interaction.user,
        target: user,
        removeAll: true,
      });

      return interaction.editReply(`✅ All warnings for **${user.tag}** were cleared.`);
    }

  } catch (err) {
    console.error("[WARN]", err);
    return interaction.editReply("❌ Failed to execute warn command.");
  }
}
