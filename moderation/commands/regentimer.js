import { PermissionFlagsBits } from "discord.js";
import { getStaffConfig, saveStaffConfig } from "../staffConfig.js";
import { hasPermission } from "../core.js";

async function canModifySetup(interaction) {
  return (
    interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
    (await hasPermission(interaction.member, "setup"))
  );
}

export default async function regentimer(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!(await canModifySetup(interaction))) {
      return interaction.editReply("❌ No permission.");
    }

    const hours = interaction.options.getInteger("hours");
    if (!hours || hours < 1) {
      return interaction.editReply("❌ Provide a valid hour value.");
    }

    const config = await getStaffConfig(interaction.guild);
    if (!config) {
      return interaction.editReply("❌ Run /setup start first.");
    }

    config.overrideRegenHours = hours;
    await saveStaffConfig(interaction.guild, config);

    return interaction.editReply(
      `✅ Override code regen timer updated to **${hours}** hour(s).`
    );
  } catch {
    return interaction.editReply("❌ Failed to update regen timer.");
  }
}
