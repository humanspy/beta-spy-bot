import { hasPermission } from "../../moderation/core.js";
import { getStaffConfig } from "../../moderation/staffConfig.js";
import { getPromoConfig } from "../promoConfig.js";

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

function resolveFirstPromotionRoleIds(eligibleRoles, promoConfig) {
  const configuredIds = Array.isArray(promoConfig.firstPromotionRoleIds)
    ? promoConfig.firstPromotionRoleIds
    : [];
  const eligibleIds = eligibleRoles.map(role => role.roleId);
  const filteredConfigured = configuredIds.filter(id =>
    eligibleIds.includes(id)
  );
  if (filteredConfigured.length) {
    return filteredConfigured;
  }

  const firstPromotionRoles = Math.min(
    promoConfig.firstPromotionRoles ?? 1,
    eligibleRoles.length
  );
  return eligibleRoles
    .slice(0, Math.max(firstPromotionRoles, 1))
    .map(role => role.roleId);
}

function resolveMinFirstIndex(eligibleRoles, promoConfig) {
  const firstPromotionRoleIds = resolveFirstPromotionRoleIds(
    eligibleRoles,
    promoConfig
  );
  const indexMap = new Map(
    eligibleRoles.map((role, index) => [role.roleId, index])
  );
  const indices = firstPromotionRoleIds
    .map(roleId => indexMap.get(roleId))
    .filter(index => typeof index === "number");
  if (!indices.length) return 0;
  return Math.max(...indices);
}

export default async function demotion(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!(await hasPermission(interaction.member, "demote"))) {
      return interaction.editReply("❌ No permission.");
    }

    const staffConfig = await getStaffConfig(interaction.guild);
    if (!staffConfig) {
      return interaction.editReply("❌ Run /setup start first.");
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

    const currentRoleIndices = eligibleRoles
      .map((role, index) => (member.roles.cache.has(role.roleId) ? index : -1))
      .filter(index => index >= 0);
    const currentMaxIndex =
      currentRoleIndices.length > 0 ? Math.max(...currentRoleIndices) : -1;

    const minFirstIndex = resolveMinFirstIndex(eligibleRoles, promoConfig);

    if (currentMaxIndex <= minFirstIndex) {
      return interaction.editReply(
        "✅ This member is already at the lowest demotion tier."
      );
    }

    const roleToRemove = eligibleRoles[currentMaxIndex]?.roleId;
    const rolesToRemove =
      roleToRemove && member.roles.cache.has(roleToRemove)
        ? [roleToRemove]
        : [];

    if (!rolesToRemove.length) {
      return interaction.editReply("✅ No roles to remove for this demotion.");
    }

    await member.roles.remove(rolesToRemove).catch(() => null);

    return interaction.editReply(
      `✅ Demoted **${member.user.tag}** to the previous staff tier.`
    );
  } catch (err) {
    console.error("❌ Demotion command failed:", err);
    return interaction.editReply("❌ Failed to demote this staff member.");
  }
}
