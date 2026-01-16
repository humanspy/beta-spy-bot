/* ===================== PARSING ===================== */

/**
 * Convert a duration choice string into minutes
 * @param {string} value
 * @returns {number|null}
 */
export function parseDurationChoice(value) {
  if (!value) return null;

  const match = value.match(
    /^(\d+)(m|h|d|w|min|mins|hour|hours|day|days|week|weeks)$/i
  );
  if (!match) return null;

  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "m":
    case "min":
    case "mins":
      return amount;
    case "h":
    case "hour":
    case "hours":
      return amount * 60;
    case "d":
    case "day":
    case "days":
      return amount * 1440;
    case "w":
    case "week":
    case "weeks":
      return amount * 10080;
    default:
      return null;
  }
}

/**
 * Convert a duration choice string into milliseconds
 * @param {string} value
 * @returns {number|null}
 */
export function parseDuration(value) {
  const minutes = parseDurationChoice(value);
  if (!minutes) return null;
  return minutes * 60 * 1000;
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
