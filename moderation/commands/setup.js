import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
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
  { label: "Setup", value: "setup" },
  { label: "Warn", value: "warn" },
  { label: "Timeout", value: "timeout" },
  { label: "Case", value: "case" },
  { label: "Purge", value: "purge" },
  { label: "Kick", value: "kick" },
  { label: "Ban", value: "ban" },
  { label: "Hackban", value: "hackban" },
  { label: "All permissions", value: "all" },
];

const WIZARD_TIMEOUT = 5 * 60 * 1000;

/* ===================== HELPERS ===================== */

function canModifySetup(interaction) {
  return (
    interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
    hasPermission(interaction.member, "setup")
  );
}

/* ===================== COMMAND ===================== */

export default {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Interactive setup wizard")
    .addSubcommand(sub =>
      sub.setName("start").setDescription("Run the setup wizard")
    )
    .addSubcommand(sub =>
      sub.setName("view").setDescription("View current setup")
    )
    .addSubcommand(sub =>
      sub.setName("reset").setDescription("Reset setup")
    ),

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

      return interaction.reply({ embeds: [embed], ephemeral: true });
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
        content: "🗑️ Setup has been reset.",
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
        content: "⚠️ Setup already exists. Reset it first if needed.",
        flags: 64,
      });
    }

    /* ===== Ask for number of staff roles (MODAL) ===== */

    const modal = new ModalBuilder()
      .setCustomId("setup_role_count")
      .setTitle("Setup Wizard");

    const roleInput = new TextInputBuilder()
      .setCustomId("role_count")
      .setLabel("How many staff roles? (0–15)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Example: 3")
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(roleInput)
    );

    await interaction.showModal(modal);

    const modalInt = await interaction.awaitModalSubmit({
      time: WIZARD_TIMEOUT,
      filter: i => i.customId === "setup_role_count",
    });

    const raw = modalInt.fields.getTextInputValue("role_count");
    const roleCount = Number(raw);

    if (
      Number.isNaN(roleCount) ||
      roleCount < 0 ||
      roleCount > 15
    ) {
      return modalInt.reply({
        content: "❌ Please enter a number between 0 and 15.",
        flags: 64,
      });
    }

    const config = {
      guildId,
      staffRoles: [],
      channels: {},
    };

    await modalInt.reply({
      content: `🧙 Setup started with **${roleCount}** staff roles.`,
      ephemeral: true,
    });

    /* ===================== ROLE + PERMISSIONS ===================== */

    let roleIndex = 0;

    while (roleIndex < roleCount) {
      const roleMsg = await modalInt.followUp({
        content: `Select staff role ${roleIndex + 1}/${roleCount}`,
        components: [
          new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder()
              .setCustomId("wizard_role")
              .setMaxValues(1)
          ),
        ],
        flags: 64,
      });

    const roleInt = await roleMsg.awaitMessageComponent({
      componentType: 8,
      time: WIZARD_TIMEOUT,
    });

    // ✅ ACKNOWLEDGE IMMEDIATELY
    await roleInt.deferUpdate();

    const roleId = roleInt.values[0];



      await roleInt.update({
        content: "Select permissions for this role",
        components: [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("wizard_perms")
              .setMinValues(1)
              .setMaxValues(PERMISSIONS.length)
              .addOptions(PERMISSIONS)
          ),
        ],
      });

      const permInt = await roleMsg.awaitMessageComponent({
        componentType: 3,
        time: WIZARD_TIMEOUT,
      });

      await permInt.deferUpdate();

      config.staffRoles.push({
        roleId,
        level: roleIndex,
        permissions: permInt.values.includes("all")
          ? "all"
          : permInt.values,
      });

      await permInt.update({
        content: "✅ Role saved.",
        components: [],
      });

      roleIndex++;
    }

    /* ===================== CHANNELS ===================== */

    const askChannel = async (label) => {
      const msg = await modalInt.followUp({
        content: `Select **${label}** channel`,
        components: [
          new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId(`wizard_${label}`)
              .addChannelTypes(ChannelType.GuildText)
          ),
        ],
        flags: 64,
      });

      const i = await msg.awaitMessageComponent({
        componentType: 8,
        time: WIZARD_TIMEOUT,
      });

      await i.deferUpdate();

      await i.update({ content: "✅ Saved.", components: [] });
      return i.values[0];

      

    };

    config.channels.overrideCodes = await askChannel("override-codes");
    config.channels.modLogs = await askChannel("mod-logs");
    config.channels.counting = await askChannel("counting");

    await enableCounting(guildId, config.channels.counting);
    saveStaffConfig(guildId, config);

    await modalInt.followUp({
      content: "🎉 Setup completed successfully!",
      flags: 64,
    });
  },
};







