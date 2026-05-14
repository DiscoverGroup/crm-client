/**
 * Date utilities — all display helpers use Philippine Standard Time (Asia/Manila, UTC+8).
 * Store timestamps as UTC ISO strings; use these helpers only for display.
 */

const TZ = 'Asia/Manila';
const LOCALE = 'en-PH';

/** "May 14, 2026, 10:32:05 AM" */
export function formatDateTimePHT(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(LOCALE, {
    timeZone: TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/** "May 14, 2026" */
export function formatDatePHT(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(LOCALE, {
    timeZone: TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** "10:32:05 AM" */
export function formatTimePHT(date: Date | string, opts?: { showSeconds?: boolean }): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString(LOCALE, {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    ...(opts?.showSeconds !== false ? { second: '2-digit' } : {}),
    hour12: true,
  });
}

/**
 * Relative time label with PHT day boundary.
 * "Today at 10:32 AM" / "Yesterday at 6:00 PM" / "May 10, 2026"
 */
export function formatRelativePHT(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  // Get PHT calendar date for both now and d
  const phtFormatter = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const nowParts = phtFormatter.formatToParts(new Date());
  const dParts = phtFormatter.formatToParts(d);

  const nowDay = `${nowParts.find(p => p.type === 'year')?.value}-${nowParts.find(p => p.type === 'month')?.value}-${nowParts.find(p => p.type === 'day')?.value}`;
  const dDay = `${dParts.find(p => p.type === 'year')?.value}-${dParts.find(p => p.type === 'month')?.value}-${dParts.find(p => p.type === 'day')?.value}`;

  const timeStr = d.toLocaleTimeString(LOCALE, {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (nowDay === dDay) return `Today at ${timeStr}`;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yParts = phtFormatter.formatToParts(yesterday);
  const yDay = `${yParts.find(p => p.type === 'year')?.value}-${yParts.find(p => p.type === 'month')?.value}-${yParts.find(p => p.type === 'day')?.value}`;

  if (yDay === dDay) return `Yesterday at ${timeStr}`;

  return d.toLocaleDateString(LOCALE, {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Short relative label ("just now", "5m ago", "3h ago", "Yesterday", "May 10").
 * Uses PHT day boundaries.
 */
export function formatAgoLabelPHT(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDatePHT(d);
}

/**
 * Returns today's date in YYYY-MM-DD format using PHT.
 * Use as the default/initial value for date inputs.
 */
export function todayPHT(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ })
    .format(new Date()); // en-CA gives YYYY-MM-DD
}
