// moderation/utils/duration.js

/**
 * Parses a duration string like:
 * 10s, 10m, 2h, 1d
 * Returns milliseconds or null
 */
export function parseDuration(input) {
  if (!input) return null;

  const match = input.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "s": return value * 1000;
    case "m": return value * 60 * 1000;
    case "h": return value * 60 * 60 * 1000;
    case "d": return value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

/**
 * Used for select menus / preset choices
 * Example values: "10m", "1h", "1d", "custom"
 */
export function parseDurationChoice(choice) {
  if (!choice || choice === "custom") return null;
  return parseDuration(choice);
}

/**
 * Converts milliseconds into a human-readable label
 */
export function getDurationLabel(ms) {
  if (!ms || ms <= 0) return "Permanent";

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days !== 1 ? "s" : ""}`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? "s" : ""}`;
  if (minutes > 0) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  return `${seconds} second${seconds !== 1 ? "s" : ""}`;
}
