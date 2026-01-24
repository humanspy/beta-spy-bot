import { ChannelType, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { loadModmailConfig, saveModmailConfig } from "./config.js";
import { handleModmailInteraction, handleModmailModal } from "./dmHandler.js";

/**
 * Handles ModMail component interactions (select menus, buttons)
 * This file is called from the global interactionCreate listener.
 */
export async function handleModmailCore(interaction) {
  if (interaction.isModalSubmit()) {
    if (interaction.customId === "modmail_settings_modal") {
      if (
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.Administrator
        )
      ) {
        await interaction.reply({
          content:
            "❌ Administrator permission is required to modify ModMail settings.",
          ephemeral: true,
        });
        return true;
      }

      const config = await loadModmailConfig(interaction.guild.id);
      if (!config) {
        await interaction.reply({
          content: "❌ ModMail is not configured for this server.",
          ephemeral: true,
        });
        return true;
      }

      const anonymousInput = interaction.fields
        .getTextInputValue("modmail_settings_anonymous")
        .trim()
        .toLowerCase();
      const appealInput = interaction.fields
        .getTextInputValue("modmail_settings_appeal")
        .trim();
      if (appealInput !== "") {
        const appealLimit = Number(appealInput);
        if (!Number.isInteger(appealLimit) || appealLimit < 0) {
          await interaction.reply({
            content: "❌ Appeal limit must be a whole number (0 or higher).",
            ephemeral: true,
          });
          return true;
        }
        config.appealLimit = appealLimit;
      }

      const anonymousEnabledValues = new Set(["true", "enabled", "on", "yes"]);
      const anonymousDisabledValues = new Set(["false", "disabled", "off", "no"]);

      if (anonymousEnabledValues.has(anonymousInput)) {
        config.anonymousStaff = true;
      } else if (anonymousDisabledValues.has(anonymousInput)) {
        config.anonymousStaff = false;
      } else {
        await interaction.reply({
          content:
            "❌ Anonymous setting must be one of: enabled, disabled, true, false, on, off, yes, no.",
          ephemeral: true,
        });
        return true;
      }

      await saveModmailConfig(interaction.guild.id, config);

      const appealText =
        config.appealLimit > 0
          ? `**${config.appealLimit}**`
          : "**Unlimited**";

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(config.anonymousStaff ? 0x57f287 : 0xfaa61a)
            .setTitle("⚙️ ModMail Settings Updated")
            .setDescription(
              `Anonymous staff replies are now **${
                config.anonymousStaff ? "ENABLED" : "DISABLED"
              }**.\n` +
                `Ban appeal limit: ${appealText}\n\n` +
                (config.anonymousStaff
                  ? "Users will see replies as coming from **Staff**."
                  : "Users will see the **staff member’s username**.")
            ),
        ],
        ephemeral: true,
      });
      return true;
    }

    const handled = await handleModmailModal(interaction, interaction.client);
    if (handled) return true;
  }

  if (interaction.isStringSelectMenu() || interaction.isButton()) {
    const handled = await handleModmailInteraction(
      interaction,
      interaction.client
    );
    if (handled) return true;
  }
  if (!interaction.isChannelSelectMenu()) return false;
  if (interaction.customId !== "modmail_forum_select") return false;

  const forum = interaction.channels.first();

  if (!forum || forum.type !== ChannelType.GuildForum) {
    await interaction.reply({
      content: "❌ Invalid selection. Please select a forum channel.",
      flags: 64,
    });
    return true;
  }

  /* ===================== CREATE / FETCH TAGS ===================== */

  let openTag = forum.availableTags.find(t => t.name === "Open");
  let closedTag = forum.availableTags.find(t => t.name === "Closed");

  if (!openTag) {
    openTag = await forum.createTag({
      name: "Open",
      moderated: true,
    });
  }

  if (!closedTag) {
    closedTag = await forum.createTag({
      name: "Closed",
      moderated: true,
    });
  }

  /* ===================== SAVE CONFIG ===================== */

  await saveModmailConfig(interaction.guild.id, {
    enabled: true,
    forumChannelId: forum.id,
    tags: {
      open: openTag.id,
      closed: closedTag.id,
    },
    anonymousStaff: false,
    appealLimit: 2,
    ticketTypes: {
      Question: { guide: "Ask your question clearly.", tags: [] },
      "User Report": { guide: "Report a User.", tags: [] },
      "Ban Appeal": { guide: "Explain why your ban should be reviewed.", tags: [] },
    },
  });

  await interaction.update({
    content:
      "✅ **ModMail setup complete!**\n\n" +
      `📁 Forum: <#${forum.id}>\n` +
      "🏷️ Tags: Open / Closed\n" +
      "🔒 Closed tickets will be locked automatically.",
    components: [],
  });

  return true;
}



