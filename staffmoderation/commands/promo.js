import { PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { hasPermission } from "../../moderation/core.js";
import { getPromotionConfig, savePromotionConfig } from "../promotionConfig.js";
import { getSortedStaffRoles, promoteStaffMember } from "../utils.js";
import { runAutoPromotions } from "../autoStaffLogic.js";

export default async function promo(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "setup") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Administrator permission required.", ephemeral: true });
    }

    const entryRolesStr = interaction.options.getString("entry_roles");
    const maxRole = interaction.options.getRole("max_role");
    const role1 = interaction.options.getRole("entry_role_1");
    const role2 = interaction.options.getRole("entry_role_2");
    const role3 = interaction.options.getRole("entry_role_3");

    const currentConfig = await getPromotionConfig(interaction.guild.id) || { entryRoles: [], maxRoleId: null };
    let entryRoles = currentConfig.entryRoles;

    if (entryRolesStr || role1 || role2 || role3) {
      const fromString = entryRolesStr 
        ? entryRolesStr.split(",").map(r => r.trim().replace(/[^0-9]/g, "")).filter(Boolean)
        : [];
      const fromRoles = [role1, role2, role3].filter(Boolean).map(r => r.id);
      entryRoles = [...new Set([...fromString, ...fromRoles])];
    }

    const maxRoleId = maxRole ? maxRole.id : currentConfig.maxRoleId;

    await savePromotionConfig(interaction.guild.id, {
      entryRoles,
      maxRoleId
    });

    return interaction.reply({
      content: `✅ Promotion config saved.\nEntry Roles: ${entryRoles.map(r => `<@&${r}>`).join(", ") || "None"}\nMax Auto-Promo Role: ${maxRoleId ? `<@&${maxRoleId}>` : "None"}`,
      ephemeral: true
    });
  }

  if (sub === "auto") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Administrator permission required.", ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    const results = await runAutoPromotions(interaction.guild);
    return interaction.editReply(`✅ Auto-promotion check complete.\nPromoted: ${results.promoted.length}\nErrors: ${results.errors.length}`);
  }

  if (sub === "user") {
    if (!(await hasPermission(interaction.member, "promo"))) {
      return interaction.reply({ content: "❌ You do not have permission to promote.", ephemeral: true });
    }

    const target = interaction.options.getMember("user");
    if (!target) return interaction.reply({ content: "❌ User not found.", ephemeral: true });

    const config = await getPromotionConfig(interaction.guild.id);
    const sortedRoles = await getSortedStaffRoles(interaction.guild);

    // Check if user is staff
    const currentHighestRole = [...sortedRoles].reverse().find(r => target.roles.cache.has(r.roleId));

    if (!currentHighestRole) {
      // Not staff, try entry roles
      if (!config || !config.entryRoles.length) {
        return interaction.reply({ content: "❌ No entry roles configured. Run `/promo setup`.", ephemeral: true });
      }

      if (config.entryRoles.length === 1) {
        await target.roles.add(config.entryRoles[0], "First Promotion");
        return interaction.reply(`✅ Promoted ${target} to <@&${config.entryRoles[0]}>.`);
      }

      // Multiple entry roles, ask user
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`promo_select_${target.id}`)
          .setPlaceholder("Select entry role")
          .addOptions(config.entryRoles.map(rid => {
            const r = interaction.guild.roles.cache.get(rid);
            return { label: r?.name || rid, value: rid };
          }))
      );

      const msg = await interaction.reply({ 
        content: `Select entry role for ${target}:`, 
        components: [row], 
        ephemeral: true,
        fetchReply: true 
      });

      try {
        const selection = await msg.awaitMessageComponent({ time: 60000 });
        await target.roles.add(selection.values[0], "First Promotion");
        await selection.update({ content: `✅ Promoted ${target} to <@&${selection.values[0]}>.`, components: [] });
      } catch {
        await interaction.editReply({ content: "❌ Timed out.", components: [] });
      }
      return;
    }

    // Is staff, promote to next level
    const currentIndex = sortedRoles.findIndex(r => r.roleId === currentHighestRole.roleId);
    const nextRole = sortedRoles[currentIndex + 1];

    if (!nextRole) {
      return interaction.reply({ content: "❌ User is already at the highest staff level.", ephemeral: true });
    }

    await promoteStaffMember(interaction.guild, target, nextRole, "Manual Promotion");
    return interaction.reply(`✅ Promoted ${target} to **${interaction.guild.roles.cache.get(nextRole.roleId)?.name}**.`);
  }
}