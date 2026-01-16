import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
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
import { isBotOwner } from "../moderation/core.js";

const pending = new Map();

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

async function getAppealEligibleGuilds(client, userId) {
  const results = [];
  for (const guild of client.guilds.cache.values()) {
    const config = await loadModmailConfig(guild.id);
    if (!config?.enabled) continue;

    const appealLimit = config.appealLimit ?? 0;
    const appealCount = await getAppealCount(guild.id, userId);
    if (appealLimit > 0 && appealCount >= appealLimit) continue;

    const ban = await guild.bans.fetch(userId).catch(() => null);
    if (!ban) continue;

    results.push({ guild, config });
  }
  return results;
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
      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`modmail_close:${existingTicket.threadId}`)
          .setLabel("Close Ticket")
          .setStyle(ButtonStyle.Danger)
      );
      return message.reply({
        content:
          "ℹ️ You already have an open ticket. Close it to start a new one.",
        components: [closeRow],
      });
    }
  }

  if (state?.step === "topic") {
    const config = await loadModmailConfig(state.guildId);
    if (!config) {
      pending.delete(userId);
      return message.reply("❌ Config error.");
    }

    const openTicket = await getOpenTicketByUserGuild(userId, state.guildId);
    if (openTicket) {
      pending.delete(userId);
      return message.reply(
        "ℹ️ You already have an open ticket for this server. Close it first."
      );
    }

    if (state.type === "Ban Appeal") {
      const appealLimit = config.appealLimit ?? 0;
      const appealCount = await getAppealCount(state.guildId, userId);
      if (appealLimit > 0 && appealCount >= appealLimit) {
        pending.delete(userId);
        return message.reply("❌ Appeal limit reached.");
      }

      const guild = client.guilds.cache.get(state.guildId);
      const ban = guild
        ? await guild.bans.fetch(userId).catch(() => null)
        : null;
      if (!ban) {
        pending.delete(userId);
        return message.reply("❌ You are not banned from that server.");
      }
    }

    try {
      const ticket = await createTicket({
        guildId: state.guildId,
        userId,
        type: state.type,
        topic: message.content,
        client,
      });

      if (state.type === "Ban Appeal") {
        await incrementAppealCount(state.guildId, userId);
      }

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`modmail_close:${ticket.threadId}`)
          .setLabel("Close Ticket")
          .setStyle(ButtonStyle.Danger)
      );

      pending.delete(userId);
      return message.reply({
        content: "✅ Ticket created. You can close it below when resolved.",
        components: [closeRow],
      });
    } catch {
      pending.delete(userId);
      return message.reply("❌ Failed to create ticket.");
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

    options.push({ label: "Ban Appeal", value: "appeal" });

    pending.set(userId, { step: "guild" });

    return message.reply({
      content: "📩 **ModMail**\nSelect a server or choose Ban Appeal:",
      components: buildSelectRows("modmail_guild_select", options),
    });
  }

  return message.reply("ℹ️ Please use the selection menu to continue.");
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

    if (interaction.customId !== "modmail_ban_appeal") return false;

    const appealGuilds = await getAppealEligibleGuilds(client, userId);
    if (!appealGuilds.length) {
      await interaction.reply("❌ No eligible ban appeal servers found.");
      return true;
    }

    const options = appealGuilds.map(({ guild }) => ({
      label: guild.name,
      value: guild.id,
    }));

    pending.set(userId, { step: "appeal_select" });

    await interaction.reply({
      content: "🔍 Select a server to appeal your ban:",
      components: buildSelectRows("modmail_appeal_select", options),
    });
    return true;
  }

  if (interaction.customId === "modmail_guild_select") {
    const selection = interaction.values[0];
    if (selection === "appeal") {
      const appealGuilds = await getAppealEligibleGuilds(client, userId);
      if (!appealGuilds.length) {
        await interaction.reply("❌ No eligible ban appeal servers found.");
        return true;
      }

      const options = appealGuilds.map(({ guild }) => ({
        label: guild.name,
        value: guild.id,
      }));

      pending.set(userId, { step: "appeal_select" });

      await interaction.reply({
        content: "🔍 Select a server to appeal your ban:",
        components: buildSelectRows("modmail_appeal_select", options),
      });
      return true;
    }

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

    pending.set(userId, { step: "topic", guildId, type });

    const guide = config.ticketTypes?.[type]?.guide;
    await interaction.reply(
      guide
        ? `✏️ ${guide}`
        : "✏️ Please describe your issue."
    );
    return true;
  }

  if (interaction.customId === "modmail_appeal_select") {
    const guildId = interaction.values[0];
    const config = await loadModmailConfig(guildId);
    if (!config) {
      await interaction.reply("❌ Modmail is not configured for that server.");
      return true;
    }

    const appealLimit = config.appealLimit ?? 0;
    const appealCount = await getAppealCount(guildId, userId);
    if (appealLimit > 0 && appealCount >= appealLimit) {
      await interaction.reply("❌ Appeal limit reached for this server.");
      return true;
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      await interaction.reply("❌ Server not found.");
      return true;
    }

    const ban = await guild.bans.fetch(userId).catch(() => null);
    if (!ban) {
      await interaction.reply("❌ You are not banned from that server.");
      return true;
    }

    pending.set(userId, { step: "topic", guildId, type: "Ban Appeal" });

    const guide = config.ticketTypes?.["Ban Appeal"]?.guide;
    await interaction.reply(
      guide
        ? `✏️ ${guide}`
        : "✏️ Please describe your ban appeal."
    );
    return true;
  }

  return false;
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

  const anonymous = config.anonymousStaff || isBotOwner(message.author);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(anonymous ? "📨 Staff Reply" : `📨 Reply`)
    .setDescription(message.content || "*No content*")
    .setTimestamp();

  await updateTicketActivity(message.channel.id, message.id);
  await user.send({ embeds: [embed] }).catch(() => {});
}
