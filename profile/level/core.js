import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { lvlrolesWizard } from "./lvlrolesWizard.js";
import { setLevelRoleConfig } from "./levelroles.js";

function buildRolePrompt(level) {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle(`Level ${level}`)
        .setDescription(
          `Ping a role or paste a role ID for **level ${level}**.\n\n` +
            "Or press **Skip**."
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("lvlroles_skip")
          .setLabel("Skip")
          .setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}

function buildRemovePreviousPrompt() {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle("Remove Previous Roles?")
        .setDescription(
          "Should the previous level role be removed when a new one is earned?"
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("lvlroles_remove_yes")
          .setLabel("Yes")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("lvlroles_remove_no")
          .setLabel("No")
          .setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}

async function sendRolePromptToChannel(channel, level) {
  await channel.send(buildRolePrompt(level));
}

async function sendRemovePreviousToChannel(channel) {
  await channel.send(buildRemovePreviousPrompt());
}

export async function handleLevelRoleComponents(interaction) {
  const guildId = interaction.guild?.id;
  if (!guildId) return false;

  const state = lvlrolesWizard.get(guildId);
  if (!state) return false;
  if (state.userId && interaction.user.id !== state.userId) {
    await interaction.reply({
      content: "❌ Only the setup user can respond to this wizard.",
      ephemeral: true,
    });
    return true;
  }

  /* ===================== INTERVAL BUTTON ===================== */

  if (interaction.isButton() && interaction.customId === "lvlroles_interval") {
    const modal = new ModalBuilder()
      .setCustomId("lvlroles_interval_modal")
      .setTitle("Set Level Interval");

    const input = new TextInputBuilder()
      .setCustomId("interval")
      .setLabel("Interval (1–100)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return true;
  }

  /* ===================== INTERVAL MODAL ===================== */

  if (
    interaction.isModalSubmit() &&
    interaction.customId === "lvlroles_interval_modal"
  ) {
    const intervalInput = Number(
      interaction.fields.getTextInputValue("interval")
    );

    if (!intervalInput || intervalInput < 1 || intervalInput > 100) {
      return interaction.reply({
        content: "❌ Invalid interval.",
        ephemeral: true,
      });
    }

    state.interval = intervalInput;
    state.step = "roles";
    state.currentLevel = intervalInput;

    return askForRole(interaction);
  }

  /* ===================== SKIP ROLE ===================== */

  if (interaction.isButton() && interaction.customId === "lvlroles_skip") {
    state.currentLevel += state.interval;

    if (state.currentLevel > 100) {
      state.step = "remove";
      return askRemovePrevious(interaction);
    }

    return askForRole(interaction);
  }

  /* ===================== REMOVE PREVIOUS ===================== */

  if (
    interaction.isButton() &&
    interaction.customId.startsWith("lvlroles_remove_")
  ) {
    state.removePrevious = interaction.customId.endsWith("yes");
    state.step = "preview";

    return showPreview(interaction);
  }

  /* ===================== CONFIRM / CANCEL ===================== */

  if (interaction.isButton() && interaction.customId === "lvlroles_confirm") {
    await setLevelRoleConfig(interaction.guild, {
      interval: state.interval,
      removePrevious: state.removePrevious,
      roles: state.roles,
    });

    lvlrolesWizard.delete(guildId);

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("Level Roles Saved")
          .setDescription("✅ Configuration has been saved successfully."),
      ],
      components: [],
    });

    return true;
  }

  if (interaction.isButton() && interaction.customId === "lvlroles_cancel") {
    lvlrolesWizard.delete(guildId);

    await interaction.update({
      content: "❌ Level role setup cancelled.",
      embeds: [],
      components: [],
    });

    return true;
  }

  return false;
}

export async function handleLevelRoleMessage(message) {
  if (!message.guild || message.author.bot) return false;
  const state = lvlrolesWizard.get(message.guild.id);
  if (!state || state.step !== "roles") return false;
  if (state.userId && message.author.id !== state.userId) return false;

  const content = message.content ?? "";
  const roleId =
    message.mentions?.roles?.first()?.id ||
    content.match(/\d{17,19}/)?.[0];

  if (roleId) {
    state.roles[state.currentLevel] = roleId;
  }

  await message.delete().catch(() => {});

  state.currentLevel += state.interval;

  if (state.currentLevel > 100) {
    state.step = "remove";
    await sendRemovePreviousToChannel(message.channel);
    return true;
  }

  await sendRolePromptToChannel(message.channel, state.currentLevel);
  return true;
}

/* ===================== EMBED HELPERS ===================== */

async function askForRole(interaction) {
  const state = lvlrolesWizard.get(interaction.guild.id);

  if (interaction.update) {
    await interaction.update(buildRolePrompt(state.currentLevel));
  } else {
    await interaction.reply({
      ...buildRolePrompt(state.currentLevel),
      ephemeral: true,
    });
  }
}

async function askRemovePrevious(interaction) {
  await interaction.update(buildRemovePreviousPrompt());
}

async function showPreview(interaction) {
  const state = lvlrolesWizard.get(interaction.guild.id);

  const roleLines = Object.entries(state.roles)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(
      ([lvl, roleId]) => `• Level **${lvl}** → <@&${roleId}>`
    )
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle("Preview Level Roles")
    .setDescription(
      `**Interval:** ${state.interval}\n` +
      `**Remove previous roles:** ${
        state.removePrevious ? "Yes" : "No"
      }\n\n` +
      (roleLines || "*No roles configured*")
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("lvlroles_confirm")
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("lvlroles_cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.update({ embeds: [embed], components: [row] });
}

