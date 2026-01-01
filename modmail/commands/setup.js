import {
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";
import { saveModmailConfig } from "../storage/config.js";

/*
pending[userId] = {
  guildId,
  step: "forum" | "count" | "type_name" | "type_guide",
  forumChannelId,
  remaining,
  currentType,
  types: []
}
*/
const pending = new Map();

/* ===================== SLASH COMMAND ENTRY ===================== */

export default async function modmailSetup(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: "❌ You need Administrator permissions to set up ModMail.",
      ephemeral: true,
    });
  }

  pending.set(interaction.user.id, {
    guildId: interaction.guild.id,
    step: "forum",
    types: [],
  });

  const embed = new EmbedBuilder()
    .setTitle("📨 ModMail Setup")
    .setDescription(
      "Setup has started.\n\n" +
      "**Step 1:** Mention the **forum channel** to use for ModMail tickets.\n\n" +
      "Example:\n`#modmail-forum`\n\n" +
      "_Reply in this channel to continue._"
    )
    .setColor(0x2563eb);

  await interaction.reply({ embeds: [embed] });
}

/* ===================== MESSAGE-BASED WIZARD ===================== */

export async function handleModmailSetupMessage(message) {
  if (!message.guild) return;
  if (message.author.bot) return;

  const state = pending.get(message.author.id);
  if (!state || state.guildId !== message.guild.id) return;

  /* ---------- STEP 1: FORUM CHANNEL ---------- */

  if (state.step === "forum") {
    const forum = message.mentions.channels.first();

    if (!forum || forum.type !== ChannelType.GuildForum) {
      return message.reply("❌ Please mention a valid **forum channel**.");
    }

    state.forumChannelId = forum.id;
    state.step = "count";

    const embed = new EmbedBuilder()
      .setTitle("🎟️ Ticket Types")
      .setDescription(
        "**Default ticket types (always included):**\n" +
        "• General\n" +
        "• Bug Report\n" +
        "• Ban Appeal\n\n" +
        "How many **extra ticket types** do you want?\n\n" +
        "**0–7 only**\n\n" +
        "Reply with a number."
      )
      .setColor(0x2563eb);

    return message.reply({ embeds: [embed] });
  }

  /* ---------- STEP 2: COUNT ---------- */

  if (state.step === "count") {
    const count = Number(message.content.trim());

    if (Number.isNaN(count) || count < 0 || count > 7) {
      return message.reply("❌ Please reply with a number between 0 and 7.");
    }

    state.remaining = count;
    state.step = count === 0 ? "finalize" : "type_name";

    if (count === 0) return finalizeSetup(message, state);

    return message.reply(
      `✏️ Send the **name** for extra ticket type #${state.types.length + 1}`
    );
  }

  /* ---------- STEP 3: TYPE NAME ---------- */

  if (state.step === "type_name") {
    state.currentType = { name: message.content.trim() };
    state.step = "type_guide";

    return message.reply(
      "📝 Send a **guide** for this ticket type, or type `skip`."
    );
  }

  /* ---------- STEP 4: TYPE GUIDE ---------- */

  if (state.step === "type_guide") {
    if (message.content.toLowerCase() !== "skip") {
      state.currentType.guide = message.content.trim();
    }

    state.types.push(state.currentType);
    state.currentType = null;
    state.remaining--;

    if (state.remaining > 0) {
      state.step = "type_name";
      return message.reply(
        `✏️ Send the **name** for extra ticket type #${state.types.length + 1}`
      );
    }

    return finalizeSetup(message, state);
  }
}

/* ===================== FINALIZE ===================== */

async function finalizeSetup(message, state) {
  const ticketTypes = {
    General: { guide: "Describe your issue clearly." },
    "Bug Report": { guide: "Describe the bug and steps to reproduce it." },
    "Ban Appeal": { guide: "Explain why your ban should be reviewed." },
  };

  for (const t of state.types) {
    ticketTypes[t.name] = { guide: t.guide };
  }

  await saveModmailConfig(state.guildId, {
    enabled: true,
    forumChannelId: state.forumChannelId,
    anonymousStaff: false,
    appealLimit: 2,
    ticketTypes,
  });

  pending.delete(message.author.id);

  const embed = new EmbedBuilder()
    .setTitle("✅ ModMail Setup Complete")
    .setDescription(
      `📁 Forum: <#${state.forumChannelId}>\n\n` +
      "🎟️ Ticket Types:\n" +
      Object.keys(ticketTypes).map(t => `• ${t}`).join("\n")
    )
    .setColor(0x16a34a);

  await message.reply({ embeds: [embed] });
}

