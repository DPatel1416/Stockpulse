/**
 * File purpose: Provides market-session time helpers that behave the same on local machines and deployed servers.
 */

export const MARKET_TIME_ZONE = 'America/New_York';
export const MARKET_OPEN_MINUTES = 9 * 60 + 30;
export const MARKET_CLOSE_MINUTES = 16 * 60;

/**
 * Converts a date into calendar parts in the market time zone.
 * This avoids relying on the server's local timezone, which can differ on Render or other hosts.
 * @param {*} value - Date-like value to read in market time.
 * @returns {object} Numeric year, month, day, hour, minute, second, and weekday values.
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
    weekday: 'short',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: parts.weekday,
  };
}

/**
 * Converts market calendar parts into a stable key.
 * A key is simpler than comparing Date objects because these parts describe a wall-clock market date.
 * @param {object} parts - Market calendar parts.
 * @returns {string} Stable yyyy-mm-dd key in market time.
 */
export function getMarketDateKey(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/**
 * Checks whether market calendar parts represent a weekend.
 * Using calendar parts keeps weekend decisions tied to New York time, not host machine time.
 * @param {object} parts - Market calendar parts.
 * @returns {boolean} True when the market date is Saturday or Sunday.
 */
export function isMarketDateWeekend(parts) {
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)).getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Checks whether a date falls on a weekend in market time.
 * @param {*} value - Date-like value to inspect.
 * @returns {boolean} True when the market-local day is Saturday or Sunday.
 */
export function isWeekend(value) {
  return isMarketDateWeekend(getMarketDateParts(value));
}

/**
 * Returns minutes elapsed since midnight in the market timezone.
 * @param {*} value - Date-like value to inspect.
 * @returns {number} Market-local minute of day.
 */
export function getMarketMinuteOfDay(value = new Date()) {
  const parts = getMarketDateParts(value);
  return parts.hour * 60 + parts.minute;
}

/**
 * Shifts market calendar parts by a number of calendar days.
 * The calculation uses UTC noon only as a stable calendar container, not as the market instant.
 * @param {object} parts - Market calendar parts.
 * @param {number} days - Calendar days to move.
 * @returns {object} Shifted market calendar parts.
 */
export function shiftMarketDateParts(parts, days) {
  const cursor = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12));
  return {
    year: cursor.getUTCFullYear(),
    month: cursor.getUTCMonth() + 1,
    day: cursor.getUTCDate(),
  };
}

/**
 * Finds the previous weekday market calendar date.
 * @param {object} parts - Market calendar parts.
 * @returns {object} Previous non-weekend market date parts.
 */
export function previousTradingDateParts(parts) {
  let cursor = shiftMarketDateParts(parts, -1);
  while (isMarketDateWeekend(cursor)) cursor = shiftMarketDateParts(cursor, -1);
  return cursor;
}

/**
 * Finds the next weekday market calendar date.
 * @param {object} parts - Market calendar parts.
 * @returns {object} Next non-weekend market date parts.
 */
export function nextTradingDateParts(parts) {
  let cursor = shiftMarketDateParts(parts, 1);
  while (isMarketDateWeekend(cursor)) cursor = shiftMarketDateParts(cursor, 1);
  return cursor;
}

/**
 * Calculates the timezone offset for a real instant in the market timezone.
 * This keeps daylight-saving time correct without hard-coding UTC offsets.
 * @param {Date} date - Real instant used to calculate the market timezone offset.
 * @returns {number} Offset in milliseconds between market wall time and UTC.
 */
function getMarketOffsetMs(date) {
  const parts = getMarketDateParts(date);
  const marketAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return marketAsUtc - date.getTime();
}

/**
 * Converts a market wall-clock date and minute into a real UTC instant.
 * This is the core helper that prevents 3 PM Eastern from becoming 7 PM on deployed charts.
 * @param {object} parts - Market calendar parts.
 * @param {number} minuteOfDay - Minutes elapsed since market-local midnight.
 * @returns {Date} Real instant for that market wall-clock time.
 */
export function atMarketMinuteForParts(parts, minuteOfDay) {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, 0, 0);
  const offset = getMarketOffsetMs(new Date(utcGuess));
  return new Date(utcGuess - offset);
}

/**
 * Creates a date positioned at a market-session minute on the same market-local date.
 * @param {*} value - Date-like value whose market-local calendar day should be reused.
 * @param {number} minuteOfDay - Minutes elapsed since market-local midnight.
 * @returns {Date} Real instant for the requested market session minute.
 */
export function atMarketMinute(value, minuteOfDay) {
  return atMarketMinuteForParts(getMarketDateParts(value), minuteOfDay);
}

/**
 * Finds the nearest earlier weekday trading day.
 * @param {*} value - Date-like value to move from.
 * @returns {Date} Previous trading day at the same market-local minute.
 */
export function previousTradingDay(value) {
  const parts = getMarketDateParts(value);
  const minuteOfDay = parts.hour * 60 + parts.minute;
  return atMarketMinuteForParts(previousTradingDateParts(parts), minuteOfDay);
}

/**
 * Finds the nearest later weekday trading day.
 * @param {*} value - Date-like value to move from.
 * @returns {Date} Next trading day at the same market-local minute.
 */
export function nextTradingDay(value) {
  const parts = getMarketDateParts(value);
  const minuteOfDay = parts.hour * 60 + parts.minute;
  return atMarketMinuteForParts(nextTradingDateParts(parts), minuteOfDay);
}

/**
 * Moves backward by a requested number of trading days while skipping weekends.
 * @param {*} value - Date-like value to move from.
 * @param {number} daysBack - Number of weekday sessions to move backward.
 * @returns {Date} Shifted trading day at the same market-local minute.
 */
export function subtractTradingDays(value, daysBack) {
  let parts = getMarketDateParts(value);
  const minuteOfDay = parts.hour * 60 + parts.minute;
  let remaining = daysBack;

  while (remaining > 0) {
    parts = previousTradingDateParts(parts);
    remaining -= 1;
  }

  return atMarketMinuteForParts(parts, minuteOfDay);
}

/**
 * Returns the active trading day for a reference instant.
 * Before the market opens, the previous trading day is still the latest completed session.
 * @param {*} value - Reference date-like value.
 * @returns {Date} Active trading day in market time.
 */
export function getActiveTradingDay(value = new Date()) {
  const parts = getMarketDateParts(value);
  const minuteOfDay = parts.hour * 60 + parts.minute;

  if (isMarketDateWeekend(parts) || minuteOfDay < MARKET_OPEN_MINUTES) {
    return atMarketMinuteForParts(previousTradingDateParts(parts), minuteOfDay);
  }

  return atMarketMinuteForParts(parts, minuteOfDay);
}

/**
 * Finds the first weekday trading date in the year of the supplied market date.
 * @param {*} value - Reference date-like value.
 * @returns {Date} First trading day of the market-local year.
 */
export function firstTradingDayOfYear(value = new Date()) {
  const parts = getMarketDateParts(value);
  let firstDay = { year: parts.year, month: 1, day: 1 };
  if (isMarketDateWeekend(firstDay)) firstDay = nextTradingDateParts(firstDay);
  return atMarketMinuteForParts(firstDay, MARKET_OPEN_MINUTES);
}

/**
 * Converts a date into the nearest regular market-session instant.
 * @param {*} value - Date-like value to normalize.
 * @returns {Date} Date clamped to regular market hours in New York time.
 */
export function normalizeToMarketTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return normalizeToMarketTime(new Date());

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

  return date;
}

/**
 * Checks whether a timestamp lands inside regular market hours.
 * @param {*} value - Date-like value to inspect.
 * @returns {boolean} True when the timestamp is inside regular session hours.
 */
export function isRegularMarketTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  const parts = getMarketDateParts(date);
  const minuteOfDay = parts.hour * 60 + parts.minute;
  return !isMarketDateWeekend(parts) && minuteOfDay >= MARKET_OPEN_MINUTES && minuteOfDay <= MARKET_CLOSE_MINUTES;
}

/**
 * Generates regular-session timestamps in market time.
 * Fallback charts use this so deployed servers do not create points in UTC/local server time by mistake.
 * @param {*} referenceDate - Reference date-like value.
 * @param {number} sessionCount - Number of trading sessions to include.
 * @param {number} intervalMinutes - Minutes between generated points.
 * @returns {Array<Date>} Generated market-session instants.
 */
export function getMarketSessionTimestamps(referenceDate, sessionCount, intervalMinutes) {
  const referenceParts = getMarketDateParts(referenceDate);
  const activeDate = getActiveTradingDay(referenceDate);
  let cursorParts = getMarketDateParts(activeDate);
  const currentMinutes = getMarketMinuteOfDay(referenceDate);
  const isCurrentSessionActive = getMarketDateKey(referenceParts) === getMarketDateKey(cursorParts)
    && !isMarketDateWeekend(referenceParts)
    && currentMinutes >= MARKET_OPEN_MINUTES
    && currentMinutes < MARKET_CLOSE_MINUTES;
  const sessions = [];

  while (sessions.length < sessionCount) {
    if (!isMarketDateWeekend(cursorParts)) sessions.unshift(cursorParts);
    cursorParts = previousTradingDateParts(cursorParts);
  }

  return sessions.flatMap((sessionParts, sessionIndex) => {
    const isCurrentSession = isCurrentSessionActive && sessionIndex === sessions.length - 1;
    const sessionEndMinutes = isCurrentSession ? currentMinutes : MARKET_CLOSE_MINUTES;
    const timestamps = [];

    for (let minute = MARKET_OPEN_MINUTES; minute <= sessionEndMinutes; minute += intervalMinutes) {
      timestamps.push(atMarketMinuteForParts(sessionParts, minute));
    }

    return timestamps;
  });
}

/**
 * Formats a timestamp as market-local time for chart labels.
 * @param {*} value - Date-like value to display.
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
 * @param {*} value - Date-like value to display.
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
 * Formats a timestamp as a combined market-local date and time.
 * @param {*} value - Date-like value to display.
 * @param {object} dateOptions - Intl date formatting options.
 * @param {object} timeOptions - Intl time formatting options.
 * @returns {string} Combined market-local label.
 */
export function formatMarketDateTime(
  value,
  dateOptions = { weekday: 'short', month: 'short', day: 'numeric' },
  timeOptions = { hour: 'numeric', minute: '2-digit' },
) {
  return `${formatMarketDate(value, dateOptions)}, ${formatMarketTime(value, timeOptions)}`;
}
