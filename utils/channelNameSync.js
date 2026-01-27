import { pool } from "../database/mysql.js";
import { getGuildTableName } from "../database/tableNames.js";

const CHANNEL_SYNC_INTERVAL_MS = 2 * 60 * 60 * 1000;

const ensureChannelTable = async guild => {
  const tableName = getGuildTableName(guild, "channel");
  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      channel_id BIGINT NOT NULL PRIMARY KEY,
      channel_name VARCHAR(255) NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_channel_name (channel_name)
    )`
  );
  return tableName;
};

const buildChannelEntries = async guild => {
  const channels =
    (await guild.channels.fetch().catch(() => null)) ??
    guild.channels.cache;
  return [...channels.values()].map(channel => ({
    channelId: channel.id,
    channelName: channel.name ?? "",
  }));
};

const logChannelNameChanges = (guild, existingMap, entries) => {
  const changes = entries.filter(entry => {
    const existingName = existingMap.get(entry.channelId);
    return existingName && existingName !== entry.channelName;
  });
  if (!changes.length) return;
  console.log(
    `🔄 Channel names changed for guild ${guild.id}: ${changes.length} update(s).`
  );
  for (const change of changes) {
    const previousName = existingMap.get(change.channelId);
    console.log(
      `- ${change.channelId}: "${previousName}" -> "${change.channelName}"`
    );
  }
};

export const syncChannelNamesForGuild = async guild => {
  if (!guild) return;
  const tableName = await ensureChannelTable(guild);
  const entries = await buildChannelEntries(guild);

  const [rows] = await pool.query(
    `SELECT channel_id, channel_name FROM \`${tableName}\``
  );
  const existingMap = new Map(
    rows.map(row => [String(row.channel_id), row.channel_name])
  );
  logChannelNameChanges(guild, existingMap, entries);

  await pool.query(`DELETE FROM \`${tableName}\``);
  if (!entries.length) return;

  const rowsToInsert = entries.map(entry => [
    entry.channelId,
    entry.channelName,
  ]);
  const chunkSize = 1000;
  for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
    const chunk = rowsToInsert.slice(i, i + chunkSize);
    await pool.query(
      `INSERT INTO \`${tableName}\` (channel_id, channel_name)
       VALUES ?`,
      [chunk]
    );
  }
};

export const syncChannelNamesForAllGuilds = async client => {
  const guilds = [...client.guilds.cache.values()];
  for (const guild of guilds) {
    try {
      await syncChannelNamesForGuild(guild);
    } catch (err) {
      console.error(
        `❌ Failed to sync channel names for guild ${guild.id}:`,
        err
      );
    }
  }
};

export const startChannelNameCron = client => {
  setInterval(() => {
    syncChannelNamesForAllGuilds(client).catch(err => {
      console.error("❌ Channel name sync cron failed:", err);
    });
  }, CHANNEL_SYNC_INTERVAL_MS);
};
