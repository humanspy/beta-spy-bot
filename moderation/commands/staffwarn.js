import { EmbedBuilder } from "discord.js";
import { getHighestStaffRole, hasPermission, isBotOwner } from "../core.js";
import { getStaffConfig, saveStaffConfig } from "../staffConfig.js";
import {
  addStaffWarn,
  getActiveStaffWarns,
  removeStaffWarn,
} from "../staffWarns.js";

export default async function staffwarn(interaction, sub) {
  try {
    await interaction.deferReply({ ephemeral: true });

    if (!(await hasPermission(interaction.member, "staffwarn"))) {
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
      if (staffRole && !isBotOwner(interaction.user)) {
        return interaction.editReply(
          "❌ Staff are immune to moderation unless a bot owner issues the command."
        );
      }

      const activeWarns = await getActiveStaffWarns(
        interaction.guild,
        staffMember.id
      );
      if (activeWarns.length >= maxWarns) {
        return interaction.editReply(
          `❌ This staff member already has the maximum of ${maxWarns} active warnings.`
        );
      }

      const result = await addStaffWarn(interaction.guild, {
        staffId: staffMember.id,
        staffTag: staffMember.user.tag,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        reason,
      });

      if (activeWarns.length + 1 >= maxWarns) {
        const rolesToRemove = (config.staffRoles ?? [])
          .map(role => role.roleId)
          .filter(roleId => staffMember.roles.cache.has(roleId));
        if (rolesToRemove.length) {
          await staffMember.roles.remove(rolesToRemove).catch(() => {});
        }
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

      return interaction.editReply(
        `⚠️ Staff warning issued to **${staffMember.user.tag}** (ID #${result.warnId}).`
      );
    }

    if (sub === "remove") {
      const warnId = interaction.options.getInteger("warn_id");
      if (!warnId) {
        return interaction.editReply("❌ Provide a warning ID.");
      }

      const removed = await removeStaffWarn(interaction.guild, warnId);
      if (!removed) {
        return interaction.editReply("❌ Warning not found.");
      }

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("✅ Staff Warning Removed")
        .addFields(
          { name: "Warn ID", value: `#${warnId}` },
          { name: "Moderator", value: `<@${interaction.user.id}>` }
        )
        .setTimestamp();

      const channelId = config.channels?.staffWarnings;
      if (channelId) {
        const channel = await interaction.guild.channels
          .fetch(channelId)
          .catch(() => null);
        if (channel?.isTextBased()) {
          await channel.send({ embeds: [embed] });
        }
      }

      return interaction.editReply(`✅ Staff warning #${warnId} removed.`);
    }

    if (sub === "list") {
      const staffMember = interaction.options.getMember("user");
      if (!staffMember) {
        return interaction.editReply("❌ Staff member not found.");
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

    if (sub === "config") {
      const maxWarnsInput = interaction.options.getInteger("max_warns");
      if (!maxWarnsInput || maxWarnsInput < 1 || maxWarnsInput > 20) {
        return interaction.editReply("❌ Max warns must be between 1 and 20.");
      }

      config.staffWarnConfig = {
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
