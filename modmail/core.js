import { ChannelType } from "discord.js";
import { saveModmailConfig } from "./config.js";
import { handleModmailInteraction } from "./dmHandler.js";

/**
 * Handles ModMail component interactions (select menus, buttons)
 * This file is called from the global interactionCreate listener.
 */
export async function handleModmailCore(interaction) {
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



