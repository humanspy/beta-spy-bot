import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
  REST,
  Routes,
} from "discord.js";

import {
  saveStaffConfig,
  getStaffConfig,
  deleteStaffConfig,
} from "../staffConfig.js";

import { enableCounting } from "../../counting/storage.js";
import { hasPermission } from "../core.js";
import { guildCommands } from "../../guild-commands.js";

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

function stepEmbed(title, description, footer) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: footer });
}

async function awaitUserMessage(interaction, modalInt, embed) {
  await modalInt.followUp({ embeds: [embed], flags: 64 });

  const collected = await interaction.channel.awaitMessages({
    max: 1,
    time: WIZARD_TIMEOUT,
    filter: m => m.author.id === interaction.user.id,
  });

  const msg = collected.first();
  await msg.delete().catch(() => {});
  return msg;
}

async function askRole(interaction, modalInt, index, total) {
  const embed = stepEmbed(
    `🛡️ Staff Role ${index}/${total}`,
    "Please **mention** the staff role.\n\nExample:\n`@Moderator`",
    "Waiting for role mention…"
  );

  const msg = await awaitUserMessage(interaction, modalInt, embed);
  const role = msg.mentions.roles.first();

  if (!role) throw new Error("Invalid role");
  return role;
}

async function askPermissions(interaction, modalInt, roleName) {
  const embed = stepEmbed(
    `🔐 Permissions for ${roleName}`,
    `Send permissions **comma-separated**.\n\n` +
      `Available:\n\`${PERMISSIONS.join(", ")}\`\n\n` +
      `Use \`all\` for full access.`,
    "Waiting for permissions…"
  );

  const msg = await awaitUserMessage(interaction, modalInt, embed);

  const perms = msg.content
    .toLowerCase()
    .split(",")
    .map(p => p.trim())
    .filter(Boolean);

  if (!perms.length) throw new Error("No permissions");
  if (!perms.every(p => PERMISSIONS.includes(p)))
    throw new Error("Invalid permissions");

  return perms.includes("all") ? "all" : perms;
}

async function askChannel(interaction, modalInt, label, description) {
  const embed = stepEmbed(
    `📌 ${label} Channel`,
    `${description}\n\nMention the channel.\nExample:\n\`#mod-logs\``,
    "Waiting for channel mention…"
  );

  const msg = await awaitUserMessage(interaction, modalInt, embed);
  const channel = msg.mentions.channels.first();

  if (!channel || channel.type !== ChannelType.GuildText)
    throw new Error("Invalid channel");

  return channel.id;
}

async function registerGuildCommands(guildId) {
  const rest = new REST({ version: "10" }).setToken(
    process.env.DISCORD_BOT_TOKEN
  );

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.DISCORD_CLIENT_ID,
      guildId
    ),
    { body: guildCommands }
  );
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
          embeds: [
            stepEmbed(
              "❌ Setup Not Found",
              "This server has not been set up yet.",
              "Run /setup start"
            ),
          ],
          flags: 64,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("⚙️ Server Setup")
        .setColor(0x57f287)
        .addFields(
          {
            name: "Staff Roles",
            value: existing.staffRoles
              .sort((a, b) => a.level - b.level)
              .map(r =>
                `<@&${r.roleId}> — ${
                  r.permissions === "all"
                    ? "ALL"
                    : r.permissions.join(", ")
                }`
              )
              .join("\n"),
          },
          {
            name: "Channels",
            value: Object.entries(existing.channels)
              .map(([k, v]) => `${k}: <#${v}>`)
              .join("\n"),
          }
        );

      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    /* ===================== RESET ===================== */

    if (sub === "reset") {
      if (!canModifySetup(interaction)) {
        return interaction.reply({
          embeds: [
            stepEmbed(
              "❌ Missing Permission",
              "You do not have permission to reset setup.",
              "Permission: setup"
            ),
          ],
          flags: 64,
        });
      }

      deleteStaffConfig(guildId);
      return interaction.reply({
        embeds: [
          stepEmbed(
            "🗑️ Setup Reset",
            "Server setup has been successfully reset.",
            "You may now run /setup start"
          ),
        ],
        flags: 64,
      });
    }

    /* ===================== START ===================== */

    if (!canModifySetup(interaction)) {
      return interaction.reply({
        embeds: [
          stepEmbed(
            "❌ Missing Permission",
            "You do not have permission to run setup.",
            "Permission: setup"
          ),
        ],
        flags: 64,
      });
    }

    if (existing?.staffRoles?.length) {
      return interaction.reply({
        embeds: [
          stepEmbed(
            "⚠️ Setup Already Exists",
            "Reset the setup before running it again.",
            "Use /setup reset"
          ),
        ],
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
        embeds: [
          stepEmbed(
            "❌ Invalid Input",
            "Role count must be between 0 and 15.",
            "Setup aborted"
          ),
        ],
        flags: 64,
      });
    }

    await modalInt.reply({
      embeds: [
        stepEmbed(
          "🧙 Setup Started",
          `You selected **${roleCount}** staff roles.`,
          "Follow the steps below"
        ),
      ],
      flags: 64,
    });

    const config = { guildId, staffRoles: [], channels: {} };

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
        "Override Codes",
        "This channel receives generated override codes."
      );
      config.channels.modLogs = await askChannel(
        interaction,
        modalInt,
        "Mod Logs",
        "This channel receives moderation logs."
      );
      config.channels.counting = await askChannel(
        interaction,
        modalInt,
        "Counting",
        "This channel is used for the counting system."
      );
    } catch {
      return modalInt.followUp({
        embeds: [
          stepEmbed(
            "❌ Setup Cancelled",
            "Invalid input was provided.",
            "No changes were saved"
          ),
        ],
        flags: 64,
      });
    }

    await enableCounting(guildId, config.channels.counting);
    saveStaffConfig(guildId, config);
    await registerGuildCommands(guildId);

    await modalInt.followUp({
      embeds: [
        stepEmbed(
          "🎉 Setup Complete",
          "Server setup finished successfully.\n\n" +
            "✅ Guild commands registered\n" +
            "⏳ Commands may take a few seconds to appear",
          "Setup complete"
        ),
      ],
      flags: 64,
    });
  },
};
