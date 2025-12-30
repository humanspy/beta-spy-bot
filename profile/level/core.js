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

export async function handleLevelRoleComponents(interaction) {
  const guildId = interaction.guild?.id;
  if (!guildId) return false;

  const state = lvlrolesWizard.get(guildId);
  if (!state) return false;

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
    const interval = Number(
      interaction.fields.getTextInputValue("interval")
    );

    if (!interval || interval < 1 || interval > 100) {
      return interaction.reply({
        content: "❌ Invalid interval.",
        ephemeral: true,
      });
    }

    state.interval = interval;
    state.step = "roles";
    state.currentLevel = 1;

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
    setLevelRoleConfig(guildId, {
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

  /* ===================== ROLE INPUT (MESSAGE) ===================== */

  if (state.step === "roles" && interaction.isRepliable() === false) {
    const content = interaction.content ?? "";
    const roleId =
      interaction.mentions?.roles?.first()?.id ||
      content.match(/\d{17,19}/)?.[0];

    if (roleId) {
      state.roles[state.currentLevel] = roleId;
    }

    state.currentLevel += state.interval;

    if (state.currentLevel > 100) {
      state.step = "remove";
      return askRemovePrevious(interaction);
    }

    return askForRole(interaction);
  }

  return false;
}

/* ===================== EMBED HELPERS ===================== */

async function askForRole(interaction) {
  const state = lvlrolesWizard.get(interaction.guild.id);

  const embed = new EmbedBuilder()
    .setTitle(`Level ${state.currentLevel}`)
    .setDescription(
      `Ping a role or paste a role ID for **level ${state.currentLevel}**.\n\n` +
      "Or press **Skip**."
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("lvlroles_skip")
      .setLabel("Skip")
      .setStyle(ButtonStyle.Secondary)
  );

  if (interaction.update) {
    await interaction.update({ embeds: [embed], components: [row] });
  } else {
    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  }
}

async function askRemovePrevious(interaction) {
  const embed = new EmbedBuilder()
    .setTitle("Remove Previous Roles?")
    .setDescription(
      "Should the previous level role be removed when a new one is earned?"
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("lvlroles_remove_yes")
      .setLabel("Yes")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("lvlroles_remove_no")
      .setLabel("No")
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.update({ embeds: [embed], components: [row] });
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

