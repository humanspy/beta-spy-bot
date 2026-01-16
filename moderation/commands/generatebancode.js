import { EmbedBuilder } from "discord.js";
import {
  generateBanOverrideCode,
  getHighestStaffRole,
  isBotOwner,
  logModerationAction,
} from "../core.js";
import { getStaffConfig } from "../staffConfig.js";

export default async function generatebancode(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const staffRole = await getHighestStaffRole(interaction.member);
    const isBypassOwner = isBotOwner(interaction.user) && !staffRole;
    if (!isBypassOwner && (!staffRole || staffRole.permissions !== "all")) {
      return interaction.editReply("❌ No permission.");
    }

    const code = await generateBanOverrideCode(
      interaction.user.tag,
      interaction.user.id
    );

    const config = await getStaffConfig(interaction.guild.id);
    const rolesWithoutBan = (config?.staffRoles ?? [])
      .filter(role => {
        if (role.permissions === "all") return false;
        return !role.permissions.includes("ban")
          && !role.permissions.includes("hackban");
      })
      .sort((a, b) => a.level - b.level)
      .map(role => `<@&${role.roleId}>`);

    const eligibleRolesText = rolesWithoutBan.length
      ? rolesWithoutBan.join(", ")
      : "All staff roles already have ban or hackban permission.";

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle("🔑 Ban Override Code")
      .setDescription(
        "Use this one-time code with the **/ban add** or **/ban hackban** command."
      )
      .addFields(
        { name: "Override Code", value: `\`${code}\`` },
        {
          name: "Who can use it?",
          value: eligibleRolesText,
        },
        {
          name: "How it works",
          value:
            "Staff without **ban** or **hackban** permissions can supply this code " +
            "to perform the action once. After use, the code expires.",
        }
      )
      .setFooter({ text: "Keep this code private." })
      .setTimestamp();

    await logModerationAction({
      guild: interaction.guild,
      actor: interaction.user,
      actorMember: interaction.member,
      action: "🔑 Ban Override Code Generated",
      target: interaction.user.tag,
      color: 0x9b59b6,
    });

    return interaction.editReply({ embeds: [embed] });
  } catch {
    return interaction.editReply("❌ Failed to generate override code.");
  }
}
