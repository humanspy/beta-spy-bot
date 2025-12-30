import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
} from "discord.js";
import { enableCounting } from "../counting/storage.js";

import {
  saveStaffConfig,
  getStaffConfig,
  deleteStaffConfig,
} from "../moderation/staffConfig.js";

import { hasPermission } from "../index.js";

const PERMISSIONS = [
  { label: "Setup (Manage bot setup)", value: "setup" },
  { label: "Warn", value: "warn" },
  { label: "Timeout", value: "timeout" },
  { label: "Case", value: "case" },
  { label: "Purge", value: "purge" },
  { label: "Help", value: "help" },
  { label: "Generate Ban Code", value: "generatebancode" },
  { label: "Kick", value: "kick" },
  { label: "Ban", value: "ban" },
  { label: "Hackban", value: "hackban" },
  { label: "All Permissions", value: "all" },
];

function canModifySetup(interaction) {
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  return hasPermission(interaction.member, "setup");
}

export default {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure staff roles, permissions, and channels")

    .addSubcommand(sub =>
      sub
        .setName("start")
        .setDescription("Initial setup (first time only)")
        .addIntegerOption(o =>
          o.setName("staff_roles")
            .setDescription("How many staff roles? (0–15)")
            .setMinValue(0)
            .setMaxValue(15)
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("edit")
        .setDescription("Edit existing setup")
        .addIntegerOption(o =>
          o.setName("staff_roles")
            .setDescription("New number of staff roles (0–15)")
            .setMinValue(0)
            .setMaxValue(15)
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("view")
        .setDescription("View current setup configuration")
    )

    .addSubcommand(sub =>
      sub
        .setName("reset")
        .setDescription("Reset all setup configuration")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const existing = getStaffConfig(guildId);

    /* ===================== PERMISSION GATE ===================== */

    if (sub !== "view" && !canModifySetup(interaction)) {
      return interaction.reply({
        content: "❌ You do not have permission to modify the setup.",
        ephemeral: true,
      });
    }

    /* ===================== VIEW ===================== */

    if (sub === "view") {
      if (!existing) {
        return interaction.reply({
          content: "❌ This server has not been set up yet.",
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("⚙️ Server Setup Configuration")
        .addFields(
          {
            name: "Staff Roles",
            value: existing.staffRoles.length
              ? existing.staffRoles
                  .sort((a, b) => a.level - b.level)
                  .map(r =>
                    `<@&${r.roleId}> — ${
                      r.permissions === "all"
                        ? "ALL"
                        : r.permissions.join(", ")
                    }`
                  )
                  .join("\n")
              : "None",
          },
          {
            name: "Override Code Channel",
            value: existing.channels?.overrideCodes
              ? `<#${existing.channels.overrideCodes}>`
              : "Not set",
            inline: true,
          },
          {
            name: "Log Channel",
            value: existing.channels?.modLogs
              ? `<#${existing.channels.modLogs}>`
              : "Not set",
            inline: true,
          }
		  {
		    name: "Counting Channel",
		    value: existing.channels?.counting
		      ? `<#${existing.channels.counting}>`
		      : "Not set",
		    inline: true,
		  }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    /* ===================== RESET ===================== */

    if (sub === "reset") {
      if (!existing) {
        return interaction.reply({
          content: "❌ Nothing to reset. Setup does not exist.",
          ephemeral: true,
        });
      }

      deleteStaffConfig(guildId);

      return interaction.reply({
        content: "🗑️ Setup has been reset. You can run `/setup start` again.",
        ephemeral: true,
      });
    }

    /* ===================== START / EDIT ===================== */

    const roleCount = interaction.options.getInteger("staff_roles");

    if (sub === "start" && existing?.staffRoles?.length) {
      return interaction.reply({
        content: "⚠️ This server is already set up. Use `/setup edit` instead.",
        ephemeral: true,
      });
    }

    const config = {
      guildId,
      channels: {},
      staffRoles: [],
    };

    await interaction.reply({
      content: sub === "edit" ? "🛠️ Editing setup…" : "🔧 Starting setup…",
      ephemeral: true,
    });

    let index = 0;

    const askRole = async () => {
      await interaction.followUp({
        content: `Select staff role ${index + 1}/${roleCount}`,
        components: [
          new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder()
              .setCustomId("setup_role")
              .setMaxValues(1)
          ),
        ],
        ephemeral: true,
      });
    };

    const askPermissions = async roleId => {
      await interaction.followUp({
        content: "Select permissions for this role",
        components: [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("setup_perms")
              .setMinValues(1)
              .setMaxValues(PERMISSIONS.length)
              .addOptions(PERMISSIONS)
          ),
        ],
        ephemeral: true,
      });

      interaction.client.once("interactionCreate", async i => {
        if (!i.isStringSelectMenu()) return;
        if (i.customId !== "setup_perms") return;

        config.staffRoles.push({
          roleId,
          level: index,
          permissions: i.values.includes("all") ? "all" : i.values,
        });

        index++;
        await i.update({ content: "✅ Permissions saved.", components: [] });

        if (index < roleCount) {
          await askRole();
        } else {
          await askChannels();
        }
      });
    };

	const askChannels = async () => {
	  /* ===== Override Code Channel ===== */
	  await interaction.followUp({
	    content: "Select the **Ban Override Code channel**",
	    components: [
	      new ActionRowBuilder().addComponents(
	        new ChannelSelectMenuBuilder()
	          .setCustomId("setup_override")
	          .addChannelTypes(ChannelType.GuildText)
	      ),
	    ],
	    ephemeral: true,
	  });

	  interaction.client.once("interactionCreate", async i => {
	    if (!i.isChannelSelectMenu()) return;
	    if (i.customId !== "setup_override") return;

	    config.channels.overrideCodes = i.values[0];
	    await i.update({ content: "✅ Override channel saved.", components: [] });

	    /* ===== Moderation Log Channel ===== */
	    await interaction.followUp({
	      content: "Select the **Moderation Log channel**",
	      components: [
	        new ActionRowBuilder().addComponents(
	          new ChannelSelectMenuBuilder()
	            .setCustomId("setup_logs")
	            .addChannelTypes(ChannelType.GuildText)
	        ),
	      ],
	      ephemeral: true,
	    });

	    interaction.client.once("interactionCreate", async i2 => {
	      if (!i2.isChannelSelectMenu()) return;
	      if (i2.customId !== "setup_logs") return;

	      config.channels.modLogs = i2.values[0];
	      await i2.update({ content: "✅ Log channel saved.", components: [] });

	      /* ===== Counting Channel ===== */
	      await interaction.followUp({
	        content: "Select the **Counting channel**",
	        components: [
	          new ActionRowBuilder().addComponents(
	            new ChannelSelectMenuBuilder()
	              .setCustomId("setup_counting")
	              .addChannelTypes(ChannelType.GuildText)
	          ),
	        ],
	        ephemeral: true,
	      });

	      interaction.client.once("interactionCreate", async i3 => {
	        if (!i3.isChannelSelectMenu()) return;
	        if (i3.customId !== "setup_counting") return;

	        const countingChannelId = i3.values[0];
	        config.channels.counting = countingChannelId;

	        // 🔓 ACTIVATE COUNTING (hard gate)
	        await enableCounting(guildId, countingChannelId);

	        saveStaffConfig(guildId, config);

	        await i3.update({
	          content:
	            sub === "edit"
	              ? "✅ Setup updated successfully. Counting is active."
	              : "✅ Setup completed successfully. Counting is active.",
	          components: [],
	        });
	      });
	    });
	  });
	};

