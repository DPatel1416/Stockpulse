/**
 * File purpose: Formats and normalizes stock-market chart times consistently in the browser.
 */

export const MARKET_TIME_ZONE = 'America/New_York';
export const MARKET_OPEN_MINUTES = 9 * 60 + 30;
export const MARKET_CLOSE_MINUTES = 16 * 60;

/**
 * Converts a date into calendar parts in the market time zone.
 * This keeps chart axes tied to the exchange clock instead of the user's browser timezone.
 * @param {*} value - Date-like value to read in market time.
 * @returns {object} Numeric market-local date and time parts.
 */
export function getMarketDateParts(value = new Date()) {
  const date = new Date(value);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: MARKET_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/**
 * Checks whether market-local calendar parts are on a weekend.
 * @param {object} parts - Market calendar parts.
 * @returns {boolean} True when the date is Saturday or Sunday.
 */
function isMarketDateWeekend(parts) {
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)).getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Shifts market calendar parts by calendar days.
 * @param {object} parts - Market calendar parts.
 * @param {number} days - Number of calendar days to move.
 * @returns {object} Shifted market calendar parts.
 */
function shiftMarketDateParts(parts, days) {
  const cursor = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12));
  return {
    year: cursor.getUTCFullYear(),
    month: cursor.getUTCMonth() + 1,
    day: cursor.getUTCDate(),
  };
}

/**
 * Finds the previous weekday market date.
 * @param {object} parts - Market calendar parts.
 * @returns {object} Previous trading date parts.
 */
function previousTradingDateParts(parts) {
  let cursor = shiftMarketDateParts(parts, -1);
  while (isMarketDateWeekend(cursor)) cursor = shiftMarketDateParts(cursor, -1);
  return cursor;
}

/**
 * Calculates the New York timezone offset for a real instant.
 * This keeps daylight-saving time correct without hard-coding UTC offsets.
 * @param {Date} date - Real instant used for offset calculation.
 * @returns {number} Offset in milliseconds between market wall time and UTC.
 */
function getMarketOffsetMs(date) {
  const parts = getMarketDateParts(date);
  const marketAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return marketAsUtc - date.getTime();
}

/**
 * Converts market calendar parts and a minute of day into a real UTC timestamp.
 * @param {object} parts - Market calendar parts.
 * @param {number} minuteOfDay - Minutes elapsed since market-local midnight.
 * @returns {number} Real timestamp in milliseconds.
 */
export function atMarketMinuteForParts(parts, minuteOfDay) {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, 0, 0);
  const offset = getMarketOffsetMs(new Date(utcGuess));
  return utcGuess - offset;
}

/**
 * Returns the regular-session bounds for the market day that owns the reference timestamp.
 * Before the open or on weekends, the previous completed trading day is used.
 * @param {*} value - Date-like value used to choose the market day.
 * @returns {object} Start, end, and tick timestamps for a 9:30 AM to 4:00 PM session.
 */
export function getMarketSessionBounds(value = new Date()) {
  let parts = getMarketDateParts(value);
  const minuteOfDay = parts.hour * 60 + parts.minute;

  if (isMarketDateWeekend(parts) || minuteOfDay < MARKET_OPEN_MINUTES) {
    parts = previousTradingDateParts(parts);
  }

  const start = atMarketMinuteForParts(parts, MARKET_OPEN_MINUTES);
  const end = atMarketMinuteForParts(parts, MARKET_CLOSE_MINUTES);
  const minute = 60 * 1000;

  return {
    start,
    end,
    ticks: [start, start + 90 * minute, start + 180 * minute, start + 270 * minute, end],
  };
}

/**
 * Converts a timestamp into the nearest regular market-session timestamp.
 * @param {*} value - Date-like value to normalize.
 * @returns {number} Timestamp clamped to regular market hours.
 */
export function normalizeMarketTimestamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return normalizeMarketTimestamp(new Date());

  const parts = getMarketDateParts(date);
  const minuteOfDay = parts.hour * 60 + parts.minute;

  if (isMarketDateWeekend(parts)) {
    return atMarketMinuteForParts(previousTradingDateParts(parts), MARKET_CLOSE_MINUTES);
  }

  if (minuteOfDay < MARKET_OPEN_MINUTES) {
    return atMarketMinuteForParts(previousTradingDateParts(parts), MARKET_CLOSE_MINUTES);
  }

  if (minuteOfDay > MARKET_CLOSE_MINUTES) {
    return atMarketMinuteForParts(parts, MARKET_CLOSE_MINUTES);
  }

  return date.getTime();
}

/**
 * Formats a timestamp as market-local time.
 * @param {*} value - Date-like value to format.
 * @param {object} options - Intl time formatting options.
 * @returns {string} Market-local time label.
 */
export function formatMarketTime(value, options = { hour: 'numeric', minute: '2-digit' }) {
  const formatOptions = options && typeof options === 'object'
    ? options
    : { hour: 'numeric', minute: '2-digit' };
  return new Date(value).toLocaleTimeString('en-US', { timeZone: MARKET_TIME_ZONE, ...formatOptions });
}

/**
 * Formats a timestamp as a market-local date.
 * @param {*} value - Date-like value to format.
 * @param {object} options - Intl date formatting options.
 * @returns {string} Market-local date label.
 */
export function formatMarketDate(value, options = { month: 'short', day: 'numeric' }) {
  const formatOptions = options && typeof options === 'object'
    ? options
    : { month: 'short', day: 'numeric' };
  return new Date(value).toLocaleDateString('en-US', { timeZone: MARKET_TIME_ZONE, ...formatOptions });
}

/**
 * Formats a timestamp as a market-local date and time.
 * @param {*} value - Date-like value to format.
 * @param {object} dateOptions - Intl date formatting options.
 * @param {object} timeOptions - Intl time formatting options.
 * @returns {string} Combined market-local label.
 */
export function formatMarketDateTime(
  value,
  dateOptions = { dateStyle: 'medium' },
  timeOptions = { timeStyle: 'short' },
) {
  return `${new Date(value).toLocaleDateString('en-CA', { timeZone: MARKET_TIME_ZONE, ...dateOptions })}, ${new Date(value).toLocaleTimeString('en-CA', { timeZone: MARKET_TIME_ZONE, ...timeOptions })}`;
}
