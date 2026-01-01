import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

import { loadModmailConfig } from "./config.js";
import {
  createTicket,
  getAppealCount,
  incrementAppealCount,
} from "./ticketManager.js";
import { loadCases } from "../moderation/core.js";

/*
pending[userId] = {
  step: "guild" | "type" | "topic",
  guildId,
  type
}
*/
const pending = new Map();

export async function handleModmailDM(message, client) {
  if (message.author.bot) return;
  if (message.guild) return;

  const userId = message.author.id;
  const state = pending.get(userId);

  /* ===================== STEP 0: FIND GUILDS ===================== */

  if (!state) {
    const rows = [];
    let buttons = [];

    for (const guild of client.guilds.cache.values()) {
      const config = await loadModmailConfig(guild.id);
      if (!config?.enabled) continue;

      try {
        const data = await loadCases(guild.id);
        const hasCase = data.cases?.some(c => c.userId === userId);
        if (!hasCase) continue;

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
      } catch {
        continue;
      }
    }

    if (buttons.length) {
      rows.push(new ActionRowBuilder().addComponents(buttons));
    }

    if (!rows.length) {
      return message.reply(
        "❌ I could not find any servers where you have a moderation case."
      );
    }

    pending.set(userId, { step: "guild" });

    return message.reply({
      content:
        "📩 **ModMail**\n\n" +
        "I found moderation cases for you in the following servers.\n" +
        "Please select the server you want to contact:",
      components: rows,
    });
  }

  /* ===================== BUTTON: GUILD SELECT ===================== */

  if (message.interaction?.customId?.startsWith("modmail_guild:")) {
    const guildId = message.interaction.customId.split(":")[1];
    const config = await loadModmailConfig(guildId);

    if (!config) {
      pending.delete(userId);
      return message.reply("❌ ModMail configuration error.");
    }

    const types = Object.keys(config.ticketTypes)
      .map((t, i) => `${i + 1}️⃣ ${t}`)
      .join("\n");

    pending.set(userId, {
      step: "type",
      guildId,
    });

    return message.reply(
      "📩 **ModMail**\n\n" +
      "What is this about?\n\n" +
      `${types}\n\n` +
      "Reply with the number."
    );
  }

  const config = await loadModmailConfig(state.guildId);
  if (!config) {
    pending.delete(userId);
    return message.reply("❌ ModMail configuration error.");
  }

  /* ===================== STEP 1: TYPE ===================== */

  if (state.step === "type") {
    const index = Number(message.content.trim()) - 1;
    const types = Object.keys(config.ticketTypes);
    const type = types[index];

    if (!type) {
      return message.reply("❌ Invalid option. Please reply with a number.");
    }

    if (type === "Ban Appeal") {
      const used = await getAppealCount(state.guildId, userId);
      if (used >= config.appealLimit) {
        pending.delete(userId);
        return message.reply(
          "❌ You have reached the maximum number of ban appeals."
        );
      }
    }

    pending.set(userId, {
      ...state,
      step: "topic",
      type,
    });

    const guide = config.ticketTypes[type]?.guide;

    return message.reply(
      `✏️ **${type}**\n` +
      (guide ? `\n${guide}\n\n` : "\n") +
      "Please describe your issue."
    );
  }

  /* ===================== STEP 2: TOPIC ===================== */

  if (state.step === "topic") {
    const topic = message.content.trim();
    if (!topic) {
      return message.reply("❌ Topic cannot be empty.");
    }

    const ticket = await createTicket({
      guildId: state.guildId,
      userId,
      type: state.type,
      topic,
      client,
    });

    if (state.type === "Ban Appeal") {
      await incrementAppealCount(state.guildId, userId);
    }

    pending.delete(userId);

    return message.reply(
      `✅ Your **${ticket.type}** ticket has been created.\n` +
      "A staff member will contact you soon."
    );
  }
}
