import { hasPermission } from "../../moderation/core.js";
import { getStaffConfig } from "../../moderation/staffConfig.js";
import { getPromoCount, setPromoCount } from "../promoCount.js";
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

export default async function promotion(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!(await hasPermission(interaction.member, "promote"))) {
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

    if (!eligibleRoles.length) {
      return interaction.editReply("❌ No eligible staff roles found.");
    }

    const currentRoleIndices = eligibleRoles
      .map((role, index) => (member.roles.cache.has(role.roleId) ? index : -1))
      .filter(index => index >= 0);
    const currentMaxIndex =
      currentRoleIndices.length > 0 ? Math.max(...currentRoleIndices) : -1;
    const promoCount = await getPromoCount(interaction.guild, member.id);

    const minFirstIndex = resolveMinFirstIndex(eligibleRoles, promoConfig);

    if (promoCount <= 0) {
      const firstPromotionRoleIds = resolveFirstPromotionRoleIds(
        eligibleRoles,
        promoConfig
      ).filter(roleId => !member.roles.cache.has(roleId));
      if (!firstPromotionRoleIds.length) {
        return interaction.editReply(
          "✅ No new roles to add for this promotion."
        );
      }
      await member.roles.add(firstPromotionRoleIds).catch(() => null);
      await setPromoCount(interaction.guild, member.id, 1);
      return interaction.editReply(
        `✅ Promoted **${member.user.tag}** to the next staff tier.`
      );
    }

    if (currentMaxIndex >= eligibleRoles.length - 1) {
      return interaction.editReply("✅ This member is already at the top role.");
    }

    const targetIndex = Math.max(currentMaxIndex + 1, minFirstIndex);
    const nextRole = eligibleRoles[targetIndex]?.roleId;
    if (!nextRole) {
      return interaction.editReply("✅ No new roles to add for this promotion.");
    }

    const rolesToAdd = member.roles.cache.has(nextRole) ? [] : [nextRole];

    if (!rolesToAdd.length) {
      return interaction.editReply("✅ No new roles to add for this promotion.");
    }

    await member.roles.add(rolesToAdd).catch(() => null);
    await setPromoCount(interaction.guild, member.id, promoCount + 1);

    return interaction.editReply(
      `✅ Promoted **${member.user.tag}** to the next staff tier.`
    );
  } catch (err) {
    console.error("❌ Promotion command failed:", err);
    return interaction.editReply("❌ Failed to promote this staff member.");
  }
}
