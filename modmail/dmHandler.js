import { loadModmailConfig } from "./config.js";
import {
  createTicket,
  getAppealCount,
  incrementAppealCount,
} from "./ticketManager.js";

/*
DM state machine:
pending[userId] = {
  guildId,
  step: "type" | "topic",
  type
}
*/
const pending = new Map();

export async function handleModmailDM(message, client) {
  if (message.author.bot) return;
  if (message.guild) return;

  const userId = message.author.id;
  const state = pending.get(userId);

  /* ===================== STEP 0: START ===================== */

  if (!state) {
    const guild = client.guilds.cache.find(async g => {
      const cfg = await loadModmailConfig(g.id);
      return cfg?.enabled;
    });

    if (!guild) {
      return message.reply(
        "❌ ModMail is not enabled on any server you share with this bot."
      );
    }

    const config = await loadModmailConfig(guild.id);
    if (!config) return;

    const types = Object.keys(config.ticketTypes)
      .map((t, i) => `${i + 1}️⃣ ${t}`)
      .join("\n");

    pending.set(userId, {
      guildId: guild.id,
      step: "type",
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
          "❌ You have reached the maximum number of ban appeals.\n\n"
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
