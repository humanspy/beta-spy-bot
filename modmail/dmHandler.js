import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { loadModmailConfig } from "./config.js";
import {
  closeTicket,
  createTicket,
  getAppealCount,
  getTicketByThreadId,
  getOpenTicketByUser,
  getOpenTicketByUserGuild,
  incrementAppealCount,
  updateTicketActivity,
} from "./ticketManager.js";

const pending = new Map();

function buildTicketModal({ title, guide }) {
  const modal = new ModalBuilder()
    .setCustomId("modmail_ticket_modal")
    .setTitle(title);

  const input = new TextInputBuilder()
    .setCustomId("modmail_ticket_content")
    .setLabel("Describe your issue")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setPlaceholder(guide ?? "Provide as much detail as you can.");

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function isStaffThreadMessage(message, forumChannelId) {
  return (
    message.guild &&
    message.channel.isThread() &&
    message.channel.parentId === forumChannelId &&
    !message.author.bot
  );
}

async function getEnabledGuilds(client) {
  const results = [];
  for (const guild of client.guilds.cache.values()) {
    const config = await loadModmailConfig(guild.id);
    if (!config?.enabled) continue;
    results.push(guild);
  }
  return results;
}

function buildSelectRows(customId, options) {
  const rows = [];
  let remaining = [...options];
  while (remaining.length) {
    const batch = remaining.slice(0, 25);
    remaining = remaining.slice(25);
    const menu = new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder("Select an option")
      .addOptions(batch);
    rows.push(new ActionRowBuilder().addComponents(menu));
  }
  return rows;
}

function buildUserMessageEmbed(message) {
  const description = message.content?.trim()
    ? message.content
    : "*Attachment(s) only*";
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({
      name: message.author.tag,
      iconURL: message.author.displayAvatarURL(),
    })
    .setDescription(description)
    .setTimestamp();
}

function getMessageFiles(message) {
  if (!message.attachments?.size) return [];
  return message.attachments.map(attachment => attachment.url);
}

/* ===================== USER → BOT ===================== */

export async function handleModmailDM(message, client) {
  if (message.author.bot || message.guild) return;

  await message.react("📬").catch(() => {});

  const userId = message.author.id;
  const state = pending.get(userId);

  if (!state) {
    const existingTicket = await getOpenTicketByUser(userId);
    if (existingTicket) {
      const thread = await client.channels
        .fetch(existingTicket.threadId)
        .catch(() => null);
      if (!thread?.isThread()) {
        return message.reply(
          "❌ Your open ticket could not be found. Please contact staff."
        );
      }

      const embed = buildUserMessageEmbed(message);
      const files = getMessageFiles(message);
      const sent = await thread
        .send({ embeds: [embed], files })
        .catch(() => null);
      if (sent) {
        await updateTicketActivity(existingTicket.threadId, sent.id);
      }
      return;
    }
  }

  if (!state) {
    const enabledGuilds = await getEnabledGuilds(client);
    const options = enabledGuilds
      .slice(0, 24)
      .map(guild => ({
        label: guild.name,
        value: `guild:${guild.id}`,
      }));

    pending.set(userId, { step: "guild" });

    return message.reply({
      content: "📩 **ModMail**\nSelect a server to open a ticket:",
      components: buildSelectRows("modmail_guild_select", options),
    });
  }

  return message.reply("ℹ️ Please use the selection menu or modal to continue.");
}

export async function handleModmailInteraction(interaction, client) {
  if (!interaction.isStringSelectMenu() && !interaction.isButton()) return false;

  const userId = interaction.user.id;

  if (interaction.isButton()) {
    if (interaction.customId.startsWith("modmail_close:")) {
      const threadId = interaction.customId.split(":")[1];
      const ticket = await getTicketByThreadId(threadId);
      if (!ticket || ticket.status !== "open") {
        await interaction.reply("❌ Ticket not found or already closed.");
        return true;
      }

      if (interaction.guild) {
        const member = interaction.member;
        if (
          !member?.permissions.has(PermissionFlagsBits.ManageThreads) &&
          !member?.permissions.has(PermissionFlagsBits.Administrator)
        ) {
          await interaction.reply("❌ Missing permission to close tickets.");
          return true;
        }
      } else if (ticket.userId !== userId) {
        await interaction.reply("❌ You can only close your own ticket.");
        return true;
      }

      const guild = client.guilds.cache.get(ticket.guildId);
      const thread = await client.channels
        .fetch(ticket.threadId)
        .catch(() => null);

      await closeTicket(ticket.threadId, userId);

      if (interaction.guild) {
        const user = await client.users.fetch(ticket.userId).catch(() => null);
        if (user) {
          await user
            .send("✅ Your Modmail ticket has been closed by staff.")
            .catch(() => {});
        }
        if (thread) {
          await thread.delete("Modmail ticket closed by staff").catch(() => {});
        }
        await interaction.reply("✅ Ticket closed and post deleted.");
      } else {
        if (thread) {
          await thread.delete("Modmail ticket closed by user").catch(() => {});
        }
        await interaction.reply("✅ Ticket closed and post deleted.");
      }
      return true;
    }

    if (!interaction.customId.startsWith("modmail_ban_appeal")) return false;

    const [, appealGuildId] = interaction.customId.split(":");
    if (!appealGuildId) {
      await interaction.reply("❌ This appeal link is missing server details.");
      return true;
    }

    const config = await loadModmailConfig(appealGuildId);
    if (!config) {
      await interaction.reply("❌ Modmail is not configured for that server.");
      return true;
    }

    const appealLimit = config.appealLimit ?? 0;
    const appealCount = await getAppealCount(appealGuildId, userId);
    if (appealLimit > 0 && appealCount >= appealLimit) {
      await interaction.reply("❌ Appeal limit reached for this server.");
      return true;
    }

    const guild = client.guilds.cache.get(appealGuildId);
    const ban = guild
      ? await guild.bans.fetch(userId).catch(() => null)
      : null;
    if (!ban) {
      await interaction.reply("❌ You are not banned from that server.");
      return true;
    }

    pending.set(userId, {
      step: "modal",
      guildId: appealGuildId,
      type: "Ban Appeal",
    });

    const guide = config.ticketTypes?.["Ban Appeal"]?.guide;
    await interaction.showModal(
      buildTicketModal({
        title: "Ban Appeal Ticket",
        guide,
      })
    );
    return true;
  }

  if (interaction.customId === "modmail_guild_select") {
    const selection = interaction.values[0];
    const guildId = selection.split(":")[1];
    const config = await loadModmailConfig(guildId);
    if (!config) {
      await interaction.reply("❌ Modmail is not configured for that server.");
      return true;
    }

    const types = Object.keys(config.ticketTypes ?? {});
    if (!types.length) {
      await interaction.reply("❌ No ticket types are configured.");
      return true;
    }

    const options = types.map(type => ({
      label: type,
      value: `${guildId}:${type}`,
    }));

    pending.set(userId, { step: "type", guildId });

    await interaction.reply({
      content: "📌 Select a ticket type:",
      components: buildSelectRows("modmail_ticket_type", options),
    });
    return true;
  }

  if (interaction.customId === "modmail_ticket_type") {
    const [guildId, type] = interaction.values[0].split(":");
    const config = await loadModmailConfig(guildId);
    if (!config) {
      await interaction.reply("❌ Modmail is not configured for that server.");
      return true;
    }

    const openTicket = await getOpenTicketByUserGuild(userId, guildId);
    if (openTicket) {
      await interaction.reply(
        "ℹ️ You already have an open ticket for this server. Close it first."
      );
      return true;
    }

    if (type === "Ban Appeal") {
      const appealLimit = config.appealLimit ?? 0;
      const appealCount = await getAppealCount(guildId, userId);
      if (appealLimit > 0 && appealCount >= appealLimit) {
        await interaction.reply("❌ Appeal limit reached for this server.");
        return true;
      }

      const guild = client.guilds.cache.get(guildId);
      const ban = guild ? await guild.bans.fetch(userId).catch(() => null) : null;
      if (!ban) {
        await interaction.reply("❌ You are not banned from that server.");
        return true;
      }
    }

    pending.set(userId, { step: "modal", guildId, type });

    const guide = config.ticketTypes?.[type]?.guide;
    await interaction.showModal(
      buildTicketModal({
        title: `${type} Ticket`,
        guide,
      })
    );
    return true;
  }

  return false;
}

export async function handleModmailModal(interaction, client) {
  if (!interaction.isModalSubmit()) return false;
  if (interaction.customId !== "modmail_ticket_modal") return false;

  const userId = interaction.user.id;
  const state = pending.get(userId);
  if (!state || state.step !== "modal") {
    await interaction.reply("❌ No pending ticket found. Please start again.");
    return true;
  }

  const { guildId, type } = state;
  const config = await loadModmailConfig(guildId);
  if (!config) {
    pending.delete(userId);
    await interaction.reply("❌ Modmail is not configured for that server.");
    return true;
  }

  const openTicket = await getOpenTicketByUserGuild(userId, guildId);
  if (openTicket) {
    pending.delete(userId);
    await interaction.reply(
      "ℹ️ You already have an open ticket for this server. Close it first."
    );
    return true;
  }

  if (type === "Ban Appeal") {
    const appealLimit = config.appealLimit ?? 0;
    const appealCount = await getAppealCount(guildId, userId);
    if (appealLimit > 0 && appealCount >= appealLimit) {
      pending.delete(userId);
      await interaction.reply("❌ Appeal limit reached for this server.");
      return true;
    }

    const guild = client.guilds.cache.get(guildId);
    const ban = guild ? await guild.bans.fetch(userId).catch(() => null) : null;
    if (!ban) {
      pending.delete(userId);
      await interaction.reply("❌ You are not banned from that server.");
      return true;
    }
  }

  const content = interaction.fields
    .getTextInputValue("modmail_ticket_content")
    .trim();

  try {
    const ticket = await createTicket({
      guildId,
      userId,
      type,
      topic: content,
      client,
    });

    if (type === "Ban Appeal") {
      await incrementAppealCount(guildId, userId);
    }

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`modmail_close:${ticket.threadId}`)
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger)
    );

    pending.delete(userId);
    await interaction.reply({
      content: "✅ Ticket created. You can close it below when resolved.",
      components: [closeRow],
    });
    return true;
  } catch {
    pending.delete(userId);
    await interaction.reply("❌ Failed to create ticket.");
    return true;
  }
}

/* ===================== STAFF → USER ===================== */

export async function handleModmailThreadMessage(message) {
  if (!message.guild || message.author.bot) return;

  const ticket = await getTicketByThreadId(message.channel.id);
  if (!ticket) return;

  const config = await loadModmailConfig(ticket.guildId);
  if (!config) return;

  if (!isStaffThreadMessage(message, config.forumChannelId)) return;

  const user = await message.client.users.fetch(ticket.userId).catch(() => null);
  if (!user) return;

  const anonymous = Boolean(config.anonymousStaff);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(anonymous ? "📨 Staff Reply" : "📨 Reply")
    .setDescription(message.content || "*No content*")
    .setTimestamp();

  if (!anonymous) {
    embed.setAuthor({
      name: message.author.tag,
      iconURL: message.author.displayAvatarURL(),
    });
  }

  await updateTicketActivity(message.channel.id, message.id);
  const files = getMessageFiles(message);
  await user.send({ embeds: [embed], files }).catch(() => {});
}
