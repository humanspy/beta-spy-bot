/* ===================== PARSING ===================== */

/**
 * Convert a duration choice string into minutes
 * @param {string} value
 * @returns {number|null}
 */
export function parseDurationChoice(value) {
  if (!value) return null;

  const match = value.match(/^(\d+)(m|h|d)$/i);
  if (!match) return null;

  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "m":
      return amount;
    case "h":
      return amount * 60;
    case "d":
      return amount * 1440;
    default:
      return null;
  }
}

/* ===================== LABEL ===================== */

/**
 * Convert minutes into a human-readable label
 * @param {number} minutes
 * @returns {string}
 */
export function getDurationLabel(minutes) {
  if (!minutes || minutes <= 0) return "Unknown duration";

  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }

  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }

  const days = Math.floor(minutes / 1440);
  return `${days} day${days !== 1 ? "s" : ""}`;
}
