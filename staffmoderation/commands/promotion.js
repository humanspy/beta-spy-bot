import { hasPermission } from "../../moderation/core.js";
import { getStaffConfig } from "../../moderation/staffConfig.js";
import { getPromoConfig, savePromoConfig } from "../promoConfig.js";

function sortRoleIdsAscending(roles) {
  return [...roles].sort((a, b) => {
    const aId = BigInt(a.roleId ?? a);
    const bId = BigInt(b.roleId ?? b);
    if (aId < bId) return -1;
    if (aId > bId) return 1;
    return 0;
  });
}

function resolveEligibleRoles(staffRoles, highestRoleId) {
  const orderedRoles = sortRoleIdsAscending(staffRoles);
  if (!highestRoleId) {
    return {
      orderedRoles,
      eligibleRoles: orderedRoles,
      highestRoleIndex: orderedRoles.length - 1,
    };
  }
  const highestRoleIndex = orderedRoles.findIndex(
    role => role.roleId === highestRoleId
  );
  if (highestRoleIndex === -1) {
    return {
      orderedRoles,
      eligibleRoles: orderedRoles,
      highestRoleIndex: -1,
    };
  }
  return {
    orderedRoles,
    eligibleRoles: orderedRoles.slice(0, highestRoleIndex + 1),
    highestRoleIndex,
  };
}

export default async function promotion(interaction, sub) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!(await hasPermission(interaction.member, "promote"))) {
      return interaction.editReply("❌ No permission.");
    }

    const staffConfig = await getStaffConfig(interaction.guild);
    if (!staffConfig) {
      return interaction.editReply("❌ Run /setup start first.");
    }

    if (sub === "config") {
      const firstPromotionRoles = interaction.options.getInteger(
        "first_roles"
      );
      if (!firstPromotionRoles || firstPromotionRoles < 1) {
        return interaction.editReply(
          "❌ First promotion roles must be at least 1."
        );
      }

      const currentConfig = (await getPromoConfig(interaction.guild)) ?? {
        highestRoleId: null,
        firstPromotionRoles: 1,
      };
      await savePromoConfig(interaction.guild, {
        ...currentConfig,
        firstPromotionRoles,
      });
      return interaction.editReply(
        `✅ First promotion will now award **${firstPromotionRoles}** role(s).`
      );
    }

    const member = interaction.options.getMember("user");
    if (!member) {
      return interaction.editReply("❌ Staff member not found.");
    }

    const promoConfig = await getPromoConfig(interaction.guild);
    if (!promoConfig?.highestRoleId) {
      return interaction.editReply(
        "❌ Promotion configuration is missing. Set the highest role in the case manager."
      );
    }

    const staffRoles = staffConfig.staffRoles ?? [];
    if (!staffRoles.length) {
      return interaction.editReply("❌ No staff roles are configured.");
    }

    const { eligibleRoles, highestRoleIndex } = resolveEligibleRoles(
      staffRoles,
      promoConfig.highestRoleId
    );

    if (highestRoleIndex === -1) {
      return interaction.editReply(
        "❌ Highest obtainable role is not configured in staff roles."
      );
    }

    if (!eligibleRoles.length) {
      return interaction.editReply("❌ No eligible staff roles found.");
    }

    const currentRoleIndices = eligibleRoles
      .map((role, index) => (member.roles.cache.has(role.roleId) ? index : -1))
      .filter(index => index >= 0);
    const currentMaxIndex =
      currentRoleIndices.length > 0 ? Math.max(...currentRoleIndices) : -1;

    if (currentMaxIndex >= eligibleRoles.length - 1) {
      return interaction.editReply("✅ This member is already at the top role.");
    }

    const firstPromotionRoles = Math.min(
      promoConfig.firstPromotionRoles ?? 1,
      eligibleRoles.length
    );
    const minFirstIndex = Math.max(firstPromotionRoles - 1, 0);
    const targetIndex =
      currentMaxIndex < minFirstIndex
        ? minFirstIndex
        : Math.min(currentMaxIndex + 1, eligibleRoles.length - 1);

    const rolesToAdd = eligibleRoles
      .slice(0, targetIndex + 1)
      .filter(role => !member.roles.cache.has(role.roleId))
      .map(role => role.roleId);

    if (!rolesToAdd.length) {
      return interaction.editReply("✅ No new roles to add for this promotion.");
    }

    await member.roles.add(rolesToAdd).catch(() => null);

    return interaction.editReply(
      `✅ Promoted **${member.user.tag}** to the next staff tier.`
    );
  } catch (err) {
    console.error("❌ Promotion command failed:", err);
    return interaction.editReply("❌ Failed to promote this staff member.");
  }
}
