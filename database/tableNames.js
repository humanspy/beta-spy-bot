export function normalizeGuildName(name) {
  if (!name) return "guild";
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "guild";
}

export function getGuildTableName(guild, suffix, guildName) {
  const id = typeof guild === "object" ? guild?.id : guild;
  const name = typeof guild === "object" ? guild?.name : guildName;
  const safeId = String(id);
  if (!/^\d+$/.test(safeId)) {
    throw new Error("Invalid guild id");
  }
  const safeName = normalizeGuildName(name);
  return `${safeName}_${safeId}_${suffix}`;
}

export function extractGuildId(tableName, suffix) {
  const match = tableName.match(new RegExp(`_(\\d+)_${suffix}$`));
  return match ? match[1] : null;
}
