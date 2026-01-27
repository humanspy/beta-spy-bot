import { EmbedBuilder } from "discord.js";
import { getHighestStaffRole, hasPermission } from "../../moderation/core.js";
import { getStaffConfig, saveStaffConfig } from "../../moderation/staffConfig.js";
import {
  addStaffWarn,
  clearStaffWarns,
  getActiveStaffWarns,
} from "../../moderation/staffWarns.js";

export default async function staffwarn(interaction, sub) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!(await hasPermission(interaction.member, "warnstaff"))) {
      return interaction.editReply("❌ No permission.");
    }

    const config = await getStaffConfig(interaction.guild);
    if (!config) {
      return interaction.editReply("❌ Run /setup start first.");
    }

    const maxWarns = config.staffWarnConfig?.maxWarns ?? 3;
    if (sub === "add") {
      const staffMember = interaction.options.getMember("user");
      const reason =
        interaction.options.getString("reason") ?? "No reason provided";

      if (!staffMember) {
        return interaction.editReply("❌ Staff member not found.");
      }
      const staffRole = await getHighestStaffRole(staffMember);
      if (!staffRole) {
        return interaction.editReply(
          "❌ Staff warnings can only be issued to staff members."
        );
      }

      const activeWarns = await getActiveStaffWarns(
        interaction.guild,
        staffMember.id
      );

      const result = await addStaffWarn(interaction.guild, {
        staffId: staffMember.id,
        staffTag: staffMember.user.tag,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        reason,
      });

      const reachedMax = activeWarns.length + 1 >= maxWarns;
      if (reachedMax) {
        await clearStaffWarns(interaction.guild, staffMember.id);
      }

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle("⚠️ Staff Warning Issued")
        .addFields(
          { name: "Staff Member", value: `<@${staffMember.id}>` },
          { name: "Moderator", value: `<@${interaction.user.id}>` },
          { name: "Reason", value: reason },
          { name: "Warn ID", value: `#${result.warnId}` }
        )
        .setTimestamp();

      try {
        await staffMember.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xf1c40f)
              .setTitle("⚠️ Staff Warning")
              .setDescription(
                `You have received a staff warning in **${interaction.guild.name}**.`
              )
              .addFields(
                { name: "Reason", value: reason },
                { name: "Warn ID", value: `#${result.warnId}` }
              )
              .setTimestamp(),
          ],
        });
      } catch {
        // user DMs closed
      }

      const channelId = config.channels?.staffWarnings;
      if (channelId) {
        const channel = await interaction.guild.channels
          .fetch(channelId)
          .catch(() => null);
        if (channel?.isTextBased()) {
          await channel.send({ embeds: [embed] });
        }
      }

      const resetNote = reachedMax
        ? " Warnings reset after reaching the maximum."
        : "";

      return interaction.editReply(
        `⚠️ Staff warning issued to **${staffMember.user.tag}** (ID #${result.warnId}).${resetNote}`
      );
    }

    if (sub === "list") {
      const staffMember = interaction.options.getMember("user");
      if (!staffMember) {
        return interaction.editReply("❌ Staff member not found.");
      }

      const staffRole = await getHighestStaffRole(staffMember);
      if (!staffRole) {
        return interaction.editReply(
          "❌ Staff warnings can only be listed for staff members."
        );
      }

      const warns = await getActiveStaffWarns(
        interaction.guild,
        staffMember.id
      );

      if (!warns.length) {
        return interaction.editReply(
          `✅ **${staffMember.user.tag}** has no active staff warnings.`
        );
      }

      const description = warns
        .map(
          warn =>
            `**#${warn.warn_id}** • <@${warn.moderator_id}> • ${warn.reason}`
        )
        .join("\n");

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`Staff Warnings for ${staffMember.user.tag}`)
        .setDescription(description);

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === "modify") {
      if (!(await hasPermission(interaction.member, "staffwarn_modify"))) {
        return interaction.editReply("❌ No permission.");
      }
      const maxWarnsInput = interaction.options.getInteger("max_warns");
      if (!maxWarnsInput || maxWarnsInput < 1 || maxWarnsInput > 20) {
        return interaction.editReply("❌ Max warns must be between 1 and 20.");
      }

      config.staffWarnConfig = {
        ...config.staffWarnConfig,
        maxWarns: maxWarnsInput,
      };
      await saveStaffConfig(interaction.guild, config);

      return interaction.editReply(
        `✅ Max staff warnings set to **${maxWarnsInput}**.`
      );
    }

    return interaction.editReply("❌ Invalid subcommand.");
  } catch {
    return interaction.editReply("❌ Failed to manage staff warnings.");
  }
}
