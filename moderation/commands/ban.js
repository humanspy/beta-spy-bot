import {
  getHighestStaffRole,
  hasPermission,
  createCaseAction,
  createRevertAction,
  generateBanOverrideCode,
  isBotOwner,
  isBotOwnerBypass,
  logModerationAction,
} from "../core.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { getStaffConfig, saveStaffConfig } from "../staffConfig.js";

async function regenerateOverrideCode({
  guild,
  actor,
  actorMember,
  reason,
  delayMs,
}) {
  if (delayMs <= 0) return;
  setTimeout(async () => {
    try {
      const config = await getStaffConfig(guild);
      if (!config) return;
      if (config.overrideCode) return;

      const code = await generateBanOverrideCode(actor.tag, actor.id);
      config.overrideCode = code;
      await saveStaffConfig(guild, config);

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle("🔁 Ban Override Code Regenerated")
        .setDescription(
          "A new override code was generated after the regen timer elapsed."
        )
        .addFields({ name: "Override Code", value: `\`${code}\`` })
        .setFooter({ text: "Keep this code private." })
        .setTimestamp();

      const channelId = config.channels?.overrideCodes;
      if (channelId) {
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (channel?.isTextBased()) {
          await channel.send({ embeds: [embed] });
        }
      }

      await logModerationAction({
        guild,
        actor,
        actorMember,
        action: "🔁 Ban Override Code Regenerated",
        target: actor.tag,
        reason,
        color: 0x9b59b6,
      });
    } catch {
      // regeneration failed
    }
  }, delayMs);
}

export async function ban(interaction, sub) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const canBan = await hasPermission(interaction.member, "ban");
    const canUnban = await hasPermission(interaction.member, "unban");
    let overrideUsed = false;
    if (sub === "add") {
      if (!canBan) {
        const overrideCode = interaction.options.getString("override_code");
        const config = await getStaffConfig(interaction.guild);
        const storedCode = config?.overrideCode;
        if (!overrideCode || !storedCode) {
          return interaction.editReply("❌ No permission.");
        }
        if (
          overrideCode.trim().toUpperCase() !== storedCode.trim().toUpperCase()
        ) {
          return interaction.editReply("❌ Invalid override code.");
        }
        overrideUsed = true;
        config.overrideCode = null;
        await saveStaffConfig(interaction.guild, config);
        const regenHours = config.overrideRegenHours ?? 24;
        await regenerateOverrideCode({
          guild: interaction.guild,
          actor: interaction.user,
          actorMember: interaction.member,
          reason: "Override code regeneration scheduled after use.",
          delayMs: regenHours * 60 * 60 * 1000,
        });
      }
    } else if (sub === "remove") {
      if (!canUnban) {
        return interaction.editReply("❌ No permission.");
      }
    } else if (!canBan) {
      return interaction.editReply("❌ No permission.");
    }

    const reason =
      interaction.options.getString("reason") ?? "No reason provided";
    const isBypassOwner = await isBotOwnerBypass(interaction.member);

    if (sub === "add") {
      const rawTarget = interaction.options.getString("target");
      const targetId = rawTarget?.match(/\d{17,20}/)?.[0];
      if (!targetId) {
        return interaction.editReply("❌ Invalid user ID or mention.");
      }
      const hackban = interaction.options.getBoolean("hackban") ?? false;
      const deleteDays = interaction.options.getInteger("delete_days");
      const member = await interaction.guild.members
        .fetch(targetId)
        .catch(() => null);

      if (!member && !hackban) {
        return interaction.editReply("❌ User not found in this server.");
      }

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
          .setCustomId(`modmail_ban_appeal:${interaction.guild.id}`)
          .setLabel("Ban Appeal")
          .setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder().addComponents(appealButton);
        await member.user
          .send({ embeds: [dmEmbed], components: [row] })
          .catch(() => {});
      }

      const banOptions = { reason };
      if (typeof deleteDays === "number") {
        banOptions.deleteMessageSeconds = Math.min(
          Math.max(deleteDays, 0),
          7
        ) * 24 * 60 * 60;
      }

      await interaction.guild.members.ban(targetId, banOptions);

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
