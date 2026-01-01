import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
} from "discord.js";

import {
  saveStaffConfig,
  getStaffConfig,
  deleteStaffConfig,
} from "../staffConfig.js";

import { enableCounting } from "../../counting/storage.js";
import { hasPermission } from "../core.js";

/* ===================== CONSTANTS ===================== */

const PERMISSIONS = [
  "setup",
  "warn",
  "timeout",
  "case",
  "purge",
  "kick",
  "ban",
  "hackban",
  "all",
];

const WIZARD_TIMEOUT = 5 * 60 * 1000;

/* ===================== HELPERS ===================== */

function canModifySetup(interaction) {
  return (
    interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
    hasPermission(interaction.member, "setup")
  );
}

async function askMessage(interaction, modalInt, prompt) {
  await modalInt.followUp({ content: prompt, flags: 64 });

  const collected = await interaction.channel.awaitMessages({
    max: 1,
    time: WIZARD_TIMEOUT,
    filter: m => m.author.id === interaction.user.id,
  });

  const msg = collected.first();
  await msg.delete().catch(() => {});
  return msg.content.trim();
}

async function askRole(interaction, modalInt, index, total) {
  await modalInt.followUp({
    content:
      `🛡️ **Staff Role ${index}/${total}**\n` +
      `Mention the role (example: @Moderator)`,
    flags: 64,
  });

  const collected = await interaction.channel.awaitMessages({
    max: 1,
    time: WIZARD_TIMEOUT,
    filter: m => m.author.id === interaction.user.id,
  });

  const msg = collected.first();
  const role = msg.mentions.roles.first();
  await msg.delete().catch(() => {});

  if (!role) throw new Error("Invalid role mention");
  return role;
}

async function askPermissions(interaction, modalInt, roleName) {
  await modalInt.followUp({
    content:
      `🔐 **Permissions for ${roleName}**\n\n` +
      `Send permissions separated by commas.\n` +
      `Available:\n\`${PERMISSIONS.join(", ")}\`\n\n` +
      `Use \`all\` for full access.`,
    flags: 64,
  });

  const collected = await interaction.channel.awaitMessages({
    max: 1,
    time: WIZARD_TIMEOUT,
    filter: m => m.author.id === interaction.user.id,
  });

  const msg = collected.first();
  await msg.delete().catch(() => {});

  const perms = msg.content
    .toLowerCase()
    .split(",")
    .map(p => p.trim())
    .filter(Boolean);

  if (!perms.length) throw new Error("No permissions provided");
  if (!perms.every(p => PERMISSIONS.includes(p)))
    throw new Error("Invalid permissions");

  return perms.includes("all") ? "all" : perms;
}

async function askChannel(interaction, modalInt, label) {
  await modalInt.followUp({
    content:
      `📌 **${label} Channel**\n` +
      `Mention the channel (example: #mod-logs)`,
    flags: 64,
  });

  const collected = await interaction.channel.awaitMessages({
    max: 1,
    time: WIZARD_TIMEOUT,
    filter: m => m.author.id === interaction.user.id,
  });

  const msg = collected.first();
  const channel = msg.mentions.channels.first();
  await msg.delete().catch(() => {});

  if (!channel || channel.type !== ChannelType.GuildText)
    throw new Error("Invalid channel");

  return channel.id;
}

/* ===================== COMMAND ===================== */

export default {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Interactive setup wizard")
    .addSubcommand(sub => sub.setName("start").setDescription("Run setup"))
    .addSubcommand(sub => sub.setName("view").setDescription("View setup"))
    .addSubcommand(sub => sub.setName("reset").setDescription("Reset setup")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand(false) ?? "start";
    const guildId = interaction.guild.id;
    const existing = getStaffConfig(guildId);

    /* ===================== VIEW ===================== */

    if (sub === "view") {
      if (!existing) {
        return interaction.reply({
          content: "❌ This server has not been set up yet.",
          flags: 64,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("⚙️ Server Setup")
        .setColor(0x3498db)
        .addFields(
          {
            name: "Staff Roles",
            value: existing.staffRoles.length
              ? existing.staffRoles
                  .sort((a, b) => a.level - b.level)
                  .map(r =>
                    `<@&${r.roleId}> — ${
                      r.permissions === "all"
                        ? "ALL"
                        : r.permissions.join(", ")
                    }`
                  )
                  .join("\n")
              : "None",
          },
          {
            name: "Override Codes",
            value: existing.channels?.overrideCodes
              ? `<#${existing.channels.overrideCodes}>`
              : "Not set",
            inline: true,
          },
          {
            name: "Mod Logs",
            value: existing.channels?.modLogs
              ? `<#${existing.channels.modLogs}>`
              : "Not set",
            inline: true,
          },
          {
            name: "Counting",
            value: existing.channels?.counting
              ? `<#${existing.channels.counting}>`
              : "Not set",
            inline: true,
          }
        );

      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    /* ===================== RESET ===================== */

    if (sub === "reset") {
      if (!canModifySetup(interaction)) {
        return interaction.reply({
          content: "❌ Missing permission: setup",
          flags: 64,
        });
      }

      deleteStaffConfig(guildId);
      return interaction.reply({
        content: "🗑️ Setup reset.",
        flags: 64,
      });
    }

    /* ===================== START ===================== */

    if (!canModifySetup(interaction)) {
      return interaction.reply({
        content: "❌ Missing permission: setup",
        flags: 64,
      });
    }

    if (existing?.staffRoles?.length) {
      return interaction.reply({
        content: "⚠️ Setup already exists. Reset first.",
        flags: 64,
      });
    }

    /* ===================== ROLE COUNT MODAL ===================== */

    const modal = new ModalBuilder()
      .setCustomId("setup_role_count")
      .setTitle("Setup Wizard");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("role_count")
          .setLabel("How many staff roles? (0–15)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

    await interaction.showModal(modal);

    const modalInt = await interaction.awaitModalSubmit({
      time: WIZARD_TIMEOUT,
      filter: i =>
        i.customId === "setup_role_count" &&
        i.user.id === interaction.user.id,
    });

    const roleCount = Number(
      modalInt.fields.getTextInputValue("role_count")
    );

    if (Number.isNaN(roleCount) || roleCount < 0 || roleCount > 15) {
      return modalInt.reply({
        content: "❌ Enter a number between 0 and 15.",
        flags: 64,
      });
    }

    await modalInt.reply({
      content: `🧙 Setup started with **${roleCount}** staff roles.`,
      flags: 64,
    });

    const config = { guildId, staffRoles: [], channels: {} };

    /* ===================== ROLE LOOP ===================== */

    try {
      for (let i = 0; i < roleCount; i++) {
        const role = await askRole(interaction, modalInt, i + 1, roleCount);
        const perms = await askPermissions(
          interaction,
          modalInt,
          role.name
        );

        config.staffRoles.push({
          roleId: role.id,
          level: i,
          permissions: perms,
        });
      }

      config.channels.overrideCodes = await askChannel(
        interaction,
        modalInt,
        "Override Codes"
      );
      config.channels.modLogs = await askChannel(
        interaction,
        modalInt,
        "Mod Logs"
      );
      config.channels.counting = await askChannel(
        interaction,
        modalInt,
        "Counting"
      );
    } catch (err) {
      return modalInt.followUp({
        content: "❌ Setup cancelled due to invalid input.",
        flags: 64,
      });
    }

    await enableCounting(guildId, config.channels.counting);
    saveStaffConfig(guildId, config);

    await modalInt.followUp({
      content: "🎉 Setup completed successfully!",
      flags: 64,
    });
  },
};
