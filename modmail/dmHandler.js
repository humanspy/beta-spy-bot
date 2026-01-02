import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

import { loadModmailConfig } from "./config.js";
import {
  createTicket,
  getAppealCount,
  incrementAppealCount,
} from "./ticketManager.js";
import { loadCases, isBotOwner } from "../moderation/core.js";
import fs from "fs/promises";

const pending = new Map();
const TICKETS_PATH = "./modmail/storage/tickets.json";

async function loadTickets() {
  try {
    return JSON.parse(await fs.readFile(TICKETS_PATH, "utf8"));
  } catch {
    return [];
  }
}

function isStaffThreadMessage(message, forumChannelId) {
  return (
    message.guild &&
    message.channel.isThread() &&
    message.channel.parentId === forumChannelId &&
    !message.author.bot
  );
}

/* ===================== USER → BOT ===================== */

export async function handleModmailDM(message, client) {
  if (message.author.bot || message.guild) return;

  const userId = message.author.id;
  const state = pending.get(userId);

  if (!state) {
    const rows = [];
    let buttons = [];

    for (const guild of client.guilds.cache.values()) {
      const config = await loadModmailConfig(guild.id);
      if (!config?.enabled) continue;

      try {
        const data = await loadCases(guild.id);
        if (!data.cases?.some(c => c.userId === userId)) continue;

        buttons.push(
          new ButtonBuilder()
            .setCustomId(`modmail_guild:${guild.id}`)
            .setLabel(guild.name)
            .setStyle(ButtonStyle.Primary)
        );

        if (buttons.length === 5) {
          rows.push(new ActionRowBuilder().addComponents(buttons));
          buttons = [];
        }
      } catch {}
    }

    if (buttons.length) rows.push(new ActionRowBuilder().addComponents(buttons));
    if (!rows.length)
      return message.reply("❌ No servers found with moderation cases.");

    pending.set(userId, { step: "guild" });

    return message.reply({
      content: "📩 **ModMail**\nSelect a server:",
      components: rows,
    });
  }

  if (message.interaction?.customId?.startsWith("modmail_guild:")) {
    const guildId = message.interaction.customId.split(":")[1];
    const config = await loadModmailConfig(guildId);
    if (!config) return message.reply("❌ Config error.");

    pending.set(userId, { step: "type", guildId });

    return message.reply(
      Object.keys(config.ticketTypes)
        .map((t, i) => `${i + 1}. ${t}`)
        .join("\n")
    );
  }

  const config = await loadModmailConfig(state.guildId);
  if (!config) {
    pending.delete(userId);
    return message.reply("❌ Config error.");
  }

  if (state.step === "type") {
    const type = Object.keys(config.ticketTypes)[Number(message.content) - 1];
    if (!type) return message.reply("❌ Invalid option.");

    if (type === "Ban Appeal") {
      if ((await getAppealCount(state.guildId, userId)) >= config.appealLimit) {
        pending.delete(userId);
        return message.reply("❌ Appeal limit reached.");
      }
    }

    pending.set(userId, { ...state, step: "topic", type });
    return message.reply("✏️ Please describe your issue.");
  }

  if (state.step === "topic") {
    try {
      const ticket = await createTicket({
        guildId: state.guildId,
        userId,
        type: state.type,
        topic: message.content,
        client,
      });

      if (state.type === "Ban Appeal")
        await incrementAppealCount(state.guildId, userId);

      pending.delete(userId);
      return message.reply("✅ Ticket created.");
    } catch {
      pending.delete(userId);
      return message.reply("❌ Failed to create ticket.");
    }
  }
}

/* ===================== STAFF → USER ===================== */

export async function handleModmailThreadMessage(message) {
  if (!message.guild || message.author.bot) return;

  const tickets = await loadTickets();
  const ticket = tickets.find(t => t.threadId === message.channel.id);
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

  await user.send({ embeds: [embed] }).catch(() => {});
}
