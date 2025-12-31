/**
 * Parses a duration string into milliseconds.
 *
 * Supported formats:
 *  - 10s
 *  - 5m
 *  - 2h
 *  - 3d
 *  - 1w
 *
 * @param {string} input
 * @returns {number|null} milliseconds or null if invalid
 */
export function parseDuration(input) {
  if (!input || typeof input !== "string") return null;

  const match = input.toLowerCase().match(/^(\d+)(s|m|h|d|w)$/);
  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2];

  if (value <= 0) return null;

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

/**
 * Formats milliseconds into a human-readable duration.
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  if (!ms || ms <= 0) return "0s";

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days >= 1) return `${days}d`;
  if (hours >= 1) return `${hours}h`;
  if (minutes >= 1) return `${minutes}m`;
  return `${seconds}s`;
}
