/**
 * Return the uppercase first letter of a name, or '#' for non-alpha characters.
 * Used by list views for alphabet scroller section indexing.
 */
export function getFirstLetter(name: string): string {
  const ch = name.charAt(0).toUpperCase();
  return /[A-Z]/.test(ch) ? ch : '#';
}

/**
 * Common leading articles/prefixes stripped when computing artist initials.
 * Covers English, Spanish, French, German, Italian, and Portuguese articles.
 */
const ARTIST_PREFIX_RE = /^(the|a|an|el|la|las|los|le|les|der|die|das|il|lo|gli|os|as)\s+/i;

/**
 * Derive 2-character initials for an artist name.
 *
 * - Strips common leading articles ("The", "A", "El", "Le", etc.)
 * - Multi-word name → first letter of each of the first two words
 * - Single-word name → first two letters
 */
export function getArtistInitials(name: string): string {
  const stripped = name.replace(ARTIST_PREFIX_RE, '');
  const words = stripped.split(/\s+/).filter(Boolean);
  if (words.length === 0) return name.substring(0, 2).toUpperCase();
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

/**
 * Return a promise that resolves after `ms` milliseconds.
 * Used to ensure pull-to-refresh animations have a minimum visible duration.
 */
export function minDelay(ms = 2000): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format a timestamp as a human-readable relative time string.
 * Requires i18next `t` function for localised output.
 */
export function timeAgo(ts: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t('justNow');
  if (mins < 60) return t('minutesAgo', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return t('yesterday');
  if (days < 7) return t('daysAgo', { count: days });
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return t('weeksAgo', { count: weeks });
  const months = Math.floor(days / 30);
  if (months < 12) return t('monthsAgo', { count: months });
  const years = Math.floor(days / 365);
  return t('yearsAgo', { count: years });
}
