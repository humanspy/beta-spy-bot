import { hasPermission } from "../../moderation/core.js";
import { demoteStaffMember } from "../utils.js";

export default async function demote(interaction) {
  if (!(await hasPermission(interaction.member, "demote"))) {
    return interaction.reply({ content: "❌ You do not have permission to demote.", ephemeral: true });
  }

  const target = interaction.options.getMember("user");
  const reason = interaction.options.getString("reason") || "No reason provided";

  if (!target) return interaction.reply({ content: "❌ User not found.", ephemeral: true });

  const result = await demoteStaffMember(interaction.guild, target, reason);

  if (!result) {
    return interaction.reply({ content: "❌ User has no staff roles to demote from.", ephemeral: true });
  }

  return interaction.reply(`✅ Demoted ${target} from **${result.roleName || "Unknown Role"}**.`);
}