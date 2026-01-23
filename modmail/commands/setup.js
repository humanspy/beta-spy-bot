import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from "discord.js";

import {
  saveModmailConfig,
  loadModmailConfig,
} from "../config.js";

/* ===================== CONSTANTS ===================== */

const WIZARD_TIMEOUT = 5 * 60 * 1000;
const MAX_EXTRA_TYPES = 7;

/* ===================== HELPERS ===================== */

function stepEmbed(title, description, footer) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: footer });
}

async function awaitUserMessage(interaction, embed) {
  await interaction.followUp({ embeds: [embed], flags: 64 });

  const collected = await interaction.channel.awaitMessages({
    max: 1,
    time: WIZARD_TIMEOUT,
    filter: m => m.author.id === interaction.user.id,
  });

  const msg = collected.first();
  if (!msg) throw new Error("timeout");

  await msg.delete().catch(() => {});
  return msg;
}

async function askForum(interaction) {
  const embed = stepEmbed(
    "📁 ModMail Forum",
    "Please **mention the forum channel** that should be used for ModMail tickets.\n\n" +
      "Example:\n`#modmail-forum`",
    "Waiting for forum channel…"
  );

  const msg = await awaitUserMessage(interaction, embed);
  const channel = msg.mentions.channels.first();

  if (!channel || channel.type !== ChannelType.GuildForum) {
    throw new Error("invalid_forum");
  }

  return channel.id;
}

async function askExtraTypeCount(interaction) {
  const embed = stepEmbed(
    "🎟️ Ticket Types",
    "**Default ticket types (always included):**\n" +
      "• General\n" +
      "• Bug Report\n" +
      "• Ban Appeal\n\n" +
      `How many **extra ticket types** do you want?\n\n` +
      `**0–${MAX_EXTRA_TYPES} only**`,
    "Waiting for number…"
  );

  const msg = await awaitUserMessage(interaction, embed);
  const count = Number(msg.content.trim());

  if (Number.isNaN(count) || count < 0 || count > MAX_EXTRA_TYPES) {
    throw new Error("invalid_count");
  }

  return count;
}

async function askTypeName(interaction, index, total) {
  const embed = stepEmbed(
    `✏️ Ticket Type ${index}/${total}`,
    "Send the **name** of this ticket type.",
    "Waiting for name…"
  );

  const msg = await awaitUserMessage(interaction, embed);
  return msg.content.trim();
}

async function askTypeGuide(interaction, typeName) {
  const embed = stepEmbed(
    `📝 Guide for ${typeName}`,
    "Send a **guide message** for this type, or type `skip`.",
    "Waiting for guide…"
  );

  const msg = await awaitUserMessage(interaction, embed);
  if (msg.content.toLowerCase() === "skip") return null;
  return msg.content.trim();
}

async function askAnonymousMode(interaction) {
  const embed = stepEmbed(
    "🕵️ Anonymous Staff Replies",
    "Should staff replies appear **anonymous** in DMs?\n\n" +
      "**yes** → Replies appear from *Staff*\n" +
      "**no** → Show staff username\n\n" +
      "Reply with `yes` or `no`.",
    "Waiting for choice…"
  );

  const msg = await awaitUserMessage(interaction, embed);
  const value = msg.content.toLowerCase().trim();

  if (!["yes", "no"].includes(value)) {
    throw new Error("invalid_boolean");
  }

  return value === "yes";
}

async function askAppealLimit(interaction) {
  const embed = stepEmbed(
    "⛔ Ban Appeal Limit",
    "How many **ban appeals** can a user submit?\n\n" +
      "Enter a number.\n" +
      "`0` = unlimited",
    "Waiting for limit…"
  );

  const msg = await awaitUserMessage(interaction, embed);
  const limit = Number(msg.content.trim());

  if (Number.isNaN(limit) || limit < 0 || !Number.isInteger(limit)) {
    throw new Error("invalid_count");
  }

  return limit;
}

/* ===================== COMMAND ===================== */

export default {
  data: new SlashCommandBuilder()
    .setName("modmail")
    .setDescription("Configure the ModMail system")
    .addStringOption(opt =>
      opt
        .setName("action")
        .setDescription("What to do")
        .addChoices(
          { name: "Setup", value: "setup" },
          { name: "Settings", value: "settings" }
        )
    ),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const action = interaction.options.getString("action") ?? "setup";

    /* ===================== PERMISSION CHECK ===================== */

    if (
      !interaction.member.permissions.has(
        PermissionFlagsBits.Administrator
      )
    ) {
      return interaction.reply({
        embeds: [
          stepEmbed(
            "❌ Missing Permission",
            "Administrator permission is required.",
            "Permission check failed"
          ),
        ],
        flags: 64,
      });
    }

    /* ===================== SETTINGS (TOGGLE ANON) ===================== */

    if (action === "settings") {
      const config = await loadModmailConfig(guildId);

      if (!config) {
        return interaction.reply({
          embeds: [
            stepEmbed(
              "❌ ModMail Not Configured",
              "Run ModMail setup first.",
              "No configuration found"
            ),
          ],
          flags: 64,
        });
      }

      config.anonymousStaff = !config.anonymousStaff;
      await saveModmailConfig(guildId, config);

      return interaction.reply({
        embeds: [
          stepEmbed(
            "⚙️ ModMail Settings Updated",
            `Anonymous staff replies are now **${
              config.anonymousStaff ? "ENABLED" : "DISABLED"
            }**.`,
            "Setting saved"
          ),
        ],
        flags: 64,
      });
    }

    /* ===================== SETUP ===================== */

    const existing = await loadModmailConfig(guildId);

    if (existing) {
      return interaction.reply({
        embeds: [
          stepEmbed(
            "⚠️ ModMail Already Configured",
            "ModMail is already set up for this server.\n\n" +
              "Use `/modmail settings` to toggle anonymous mode.",
            "Setup blocked"
          ),
        ],
        flags: 64,
      });
    }

    await interaction.reply({
      embeds: [
        stepEmbed(
          "🧙 ModMail Setup Started",
          "Follow the steps below to configure ModMail.\n\n" +
            "⏳ This setup will timeout after 5 minutes.",
          "Setup wizard active"
        ),
      ],
      flags: 64,
    });

    const config = {
      enabled: true,
      forumChannelId: null,
      anonymousStaff: false,
      appealLimit: 2,
      ticketTypes: {
        General: { guide: "Describe your issue clearly.", tags: [] },
        "User Report": { guide: "Report a User.", tags: [] },
        "Ban Appeal": { guide: "Explain why your ban should be reviewed.", tags: [] },
      },
    };

    try {
      config.forumChannelId = await askForum(interaction);

      const extraCount = await askExtraTypeCount(interaction);

      for (let i = 0; i < extraCount; i++) {
        const name = await askTypeName(interaction, i + 1, extraCount);
        const guide = await askTypeGuide(interaction, name);
        config.ticketTypes[name] = { guide, tags: [] };
      }

      config.appealLimit = await askAppealLimit(interaction);
      config.anonymousStaff = await askAnonymousMode(interaction);
    } catch {
      return interaction.followUp({
        embeds: [
          stepEmbed(
            "❌ Setup Cancelled",
            "Invalid input or timeout occurred.\nNo changes were saved.",
            "Setup aborted"
          ),
        ],
        flags: 64,
      });
    }

    await saveModmailConfig(guildId, config);

    await interaction.followUp({
      embeds: [
        stepEmbed(
          "🎉 ModMail Setup Complete",
          "ModMail has been configured successfully.\n\n" +
            "📨 Users can now open tickets via DM\n" +
            "🔔 Tickets will ping @everyone\n" +
            `⛔ Ban appeal limit: **${
              config.appealLimit > 0 ? config.appealLimit : "Unlimited"
            }**\n` +
            `🕵️ Anonymous replies: **${
              config.anonymousStaff ? "ENABLED" : "DISABLED"
            }**`,
          "Setup complete"
        ),
      ],
      flags: 64,
    });
  },
};

