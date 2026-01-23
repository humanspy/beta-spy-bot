import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";

import { pool } from "../database/mysql.js";
import { getStaffConfig } from "../moderation/staffConfig.js";
import { guildCommands } from "../guild-commands.js";

const INVITE_SYNC_GUILD_ID = "1114470427960557650";
const INVITE_SYNC_COMMAND = "invite-sync";
const INVITE_SYNC_INTERVAL_MS = 3 * 60 * 60 * 1000;

const ensureInvitesTable = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS invites (
      guild_id BIGINT PRIMARY KEY,
      guild_name VARCHAR(255) NOT NULL,
      invite_url VARCHAR(255) NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
    )`
  );
};

const buildInviteSyncCommand = () =>
  new SlashCommandBuilder()
    .setName(INVITE_SYNC_COMMAND)
    .setDescription("Sync invites for all guilds");

const getInviteSyncRoles = config => {
  return (config?.staffRoles ?? [])
    .filter(role => {
      const perms = role.permissions;
      if (!perms) return false;
      if (perms === "all") return true;
      return Array.isArray(perms) && perms.includes("all");
    })
    .map(role => role.roleId);
};

const pickInviteChannel = async guild => {
  const me = guild.members.me ?? (await guild.members.fetchMe());
  const canInvite = channel => {
    if (channel.type !== ChannelType.GuildText) return false;
    const permissions = channel.permissionsFor(me);
    if (!permissions) return false;
    return (
      permissions.has(PermissionFlagsBits.ViewChannel) &&
      permissions.has(PermissionFlagsBits.CreateInstantInvite)
    );
  };

  if (guild.systemChannel && canInvite(guild.systemChannel)) {
    return guild.systemChannel;
  }

  return guild.channels.cache.find(canInvite) ?? null;
};

const resolveInviteUrl = async (client, guild) => {
  if (guild.vanityURLCode) {
    return {
      inviteUrl: `https://discord.gg/${guild.vanityURLCode}`,
      source: "vanity",
    };
  }

  await ensureInvitesTable();
  const [[row]] = await pool.query(
    "SELECT invite_url FROM invites WHERE guild_id = ?",
    [guild.id]
  );
  if (row?.invite_url) {
    const invite = await client.fetchInvite(row.invite_url).catch(() => null);
    if (invite?.guild?.id === guild.id) {
      return { inviteUrl: invite.url, source: "stored" };
    }
  }

  const channel = await pickInviteChannel(guild);
  if (!channel) {
    throw new Error("No channel available to create invite");
  }
  const invite = await channel.createInvite({
    maxAge: 0,
    maxUses: 0,
    unique: true,
    reason: "Invite handler sync",
  });
  return { inviteUrl: invite.url, source: "created" };
};

export const syncInviteForGuild = async (client, guild) => {
  await ensureInvitesTable();
  const { inviteUrl, source } = await resolveInviteUrl(client, guild);
  await pool.query(
    `INSERT INTO invites (guild_id, guild_name, invite_url)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       guild_name = VALUES(guild_name),
       invite_url = VALUES(invite_url)`,
    [guild.id, guild.name, inviteUrl]
  );
  return { guildId: guild.id, inviteUrl, source };
};

export const syncInvitesForAllGuilds = async client => {
  const guilds = [...client.guilds.cache.values()];
  console.log("📨 Invite sync started.");
  let processed = 0;
  for (const guild of guilds) {
    try {
      const result = await syncInviteForGuild(client, guild);
      console.log(
        `✅ Invite synced for ${guild.name} (${result.source}): ${result.inviteUrl}`
      );
      processed += 1;
    } catch (err) {
      console.error(`❌ Failed to sync invite for ${guild.id}:`, err);
    }
  }
  console.log(`📨 Invite sync finished. Processed ${processed} guild(s).`);
  return { processed };
};

export const startInviteCron = client => {
  setInterval(() => {
    syncInvitesForAllGuilds(client).catch(err => {
      console.error("❌ Invite sync cron failed:", err);
    });
  }, INVITE_SYNC_INTERVAL_MS);
};

export const registerInviteSyncCommand = async () => {
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CLIENT_ID) {
    console.warn("⚠️ Missing DISCORD_CLIENT_ID or DISCORD_BOT_TOKEN.");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(
    process.env.DISCORD_BOT_TOKEN
  );

  const commands = [...guildCommands, buildInviteSyncCommand()];
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.DISCORD_CLIENT_ID,
      INVITE_SYNC_GUILD_ID
    ),
    { body: commands }
  );
};

export const handleInviteSyncCommand = async (interaction, client) => {
  if (!interaction.isChatInputCommand()) return false;
  if (interaction.commandName !== INVITE_SYNC_COMMAND) return false;
  if (interaction.guildId !== INVITE_SYNC_GUILD_ID) {
    await interaction.reply({
      content: "❌ This command is not available in this server.",
      flags: 64,
    });
    return true;
  }

  const config = await getStaffConfig(interaction.guild);
  const allowedRoles = getInviteSyncRoles(config);
  const memberRoles = interaction.member?.roles?.cache;
  const hasRole =
    memberRoles &&
    allowedRoles.some(roleId => memberRoles.has(roleId));

  if (!hasRole) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ Missing Permission")
          .setDescription("You do not have permission to sync invites."),
      ],
      flags: 64,
    });
    return true;
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🔄 Syncing Invites")
        .setDescription("Syncing invites for all guilds..."),
    ],
    flags: 64,
  });

  const { processed } = await syncInvitesForAllGuilds(client);

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("✅ Invite Sync Complete")
        .setDescription(`Processed **${processed}** guild(s).`),
    ],
  });
  return true;
};

export const shouldIncludeInviteSyncCommand = guildId =>
  guildId === INVITE_SYNC_GUILD_ID;

export const getInviteSyncCommandDefinition = () => buildInviteSyncCommand();
