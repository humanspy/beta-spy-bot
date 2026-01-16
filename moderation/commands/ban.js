import {
  getHighestStaffRole,
  hasPermission,
  createCaseAction,
  createRevertAction,
  isBotOwner,
  isBotOwnerBypass,
  logModerationAction,
} from "../core.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { getStaffConfig, saveStaffConfig } from "../staffConfig.js";

export async function ban(interaction, sub) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const canBan = await hasPermission(interaction.member, "ban");
    let overrideUsed = false;
    if (!canBan && sub === "add") {
      const overrideCode = interaction.options.getString("override_code");
      const config = await getStaffConfig(interaction.guild);
      const storedCode = config?.overrideCode;
      if (!overrideCode || !storedCode) {
        return interaction.editReply("❌ No permission.");
      }
      if (overrideCode.trim().toUpperCase() !== storedCode.trim().toUpperCase()) {
        return interaction.editReply("❌ Invalid override code.");
      }
      overrideUsed = true;
      config.overrideCode = null;
      await saveStaffConfig(interaction.guild, config);
    } else if (!canBan) {
      return interaction.editReply("❌ No permission.");
    }

    const reason =
      interaction.options.getString("reason") ?? "No reason provided";
    const isBypassOwner = await isBotOwnerBypass(interaction.member);

    if (sub === "add") {
      const targetId = interaction.options.getString("target");
      const member = await interaction.guild.members
        .fetch(targetId)
        .catch(() => null);

      if (member) {
        const staffRole = await getHighestStaffRole(member);
        if (staffRole && !isBotOwner(interaction.user)) {
          return interaction.editReply(
            "❌ Staff are immune to moderation unless a bot owner issues the command."
          );
        }
      }

      if (member) {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("🔨 You have been banned")
          .setDescription(`Reason: ${reason}`)
          .addFields({ name: "Server", value: interaction.guild.name })
          .setTimestamp();
        const appealButton = new ButtonBuilder()
          .setCustomId("modmail_ban_appeal")
          .setLabel("Ban Appeal")
          .setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder().addComponents(appealButton);
        await member.user
          .send({ embeds: [dmEmbed], components: [row] })
          .catch(() => {});
      }

      await interaction.guild.members.ban(targetId, { reason });

      const caseNumber = isBypassOwner
        ? null
        : await createCaseAction({
            guildId: interaction.guild.id,
            guildName: interaction.guild.name,
            userId: targetId,
            username: member?.user.tag ?? targetId,
            type: "BAN",
            moderatorId: interaction.user.id,
            moderatorName: interaction.user.tag,
            reason,
          });

      await logModerationAction({
        guild: interaction.guild,
        actor: interaction.user,
        actorMember: interaction.member,
        action: "🔨 Ban Issued",
        target: member?.user
          ? `<@${member.user.id}> (${member.user.tag})`
          : targetId,
        reason,
        caseNumber,
        color: 0xe74c3c,
      });

      const overrideNote = overrideUsed ? " (override code used)" : "";
      return interaction.editReply(
        caseNumber
          ? `🔨 User **${targetId}** banned (Case #${caseNumber})${overrideNote}.`
          : `🔨 User **${targetId}** banned${overrideNote}.`
      );
    }

    if (sub === "remove") {
      const userId = interaction.options.getString("user_id");

      await interaction.guild.members.unban(userId);

      if (!isBypassOwner) {
        await createRevertAction({
          guildId: interaction.guild.id,
          guildName: interaction.guild.name,
          userId,
          type: "UNBAN",
          moderatorId: interaction.user.id,
          moderatorName: interaction.user.tag,
          reason: "User unbanned",
        });
      }

      await logModerationAction({
        guild: interaction.guild,
        actor: interaction.user,
        actorMember: interaction.member,
        action: "✅ Unban",
        target: userId,
        reason: "User unbanned",
        color: 0x57f287,
      });

      return interaction.editReply(`✅ User **${userId}** unbanned.`);
    }

    return interaction.editReply("❌ Invalid subcommand.");
  } catch {
    return interaction.editReply("❌ Failed to execute ban.");
  }
}

export default ban;
