/**
 * Scrobble service – manages "now playing" notifications and completed
 * playback scrobble submissions to the Subsonic server.
 *
 * playerService calls sendNowPlaying() and addCompletedScrobble() at the
 * appropriate RNTP event points.  This module handles all API interaction,
 * the persisted pending-scrobble queue, retry logic, and periodic processing.
 */

import { scrobbleStore } from '../store/scrobbleStore';
import { getApi } from './subsonicService';

/* ------------------------------------------------------------------ */
/*  Module state                                                       */
/* ------------------------------------------------------------------ */

let isInitialised = false;
let isProcessing = false;
let timerHandle: ReturnType<typeof setInterval> | null = null;

const PROCESS_INTERVAL_MS = 60_000; // 1 minute

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Initialise the scrobble service.  Starts a periodic timer that drains
 * the pending-scrobble queue and runs an initial processing pass to
 * submit any scrobbles left over from a previous session.
 *
 * Safe to call multiple times – subsequent calls are no-ops.
 */
export function initScrobbleService(): void {
  if (isInitialised) return;
  isInitialised = true;

  // Process any scrobbles persisted from a previous session.
  processScrobbles();

  // Periodically retry pending scrobbles.
  timerHandle = setInterval(processScrobbles, PROCESS_INTERVAL_MS);
}

/**
 * Send a "now playing" notification to the server (submission=false).
 * Fire-and-forget – failures are silently ignored.
 */
export async function sendNowPlaying(songId: string): Promise<void> {
  const api = getApi();
  if (!api) return;
  try {
    await api.scrobble({ id: songId, submission: false });
  } catch {
    // Best-effort – now-playing is ephemeral.
  }
}

/**
 * Record a completed-playback scrobble.  The item is added to the
 * persisted pending queue and processing is triggered immediately.
 */
export function addCompletedScrobble(songId: string): void {
  scrobbleStore.getState().addScrobble(songId, Date.now());
  processScrobbles();
}

/* ------------------------------------------------------------------ */
/*  Queue processing                                                   */
/* ------------------------------------------------------------------ */

/**
 * Process the pending-scrobble queue, submitting items to the server
 * one by one (oldest first).
 *
 * - On success the item is removed from the store.
 * - On failure a single retry is attempted.  If the retry also fails
 *   processing stops and remaining items stay in the queue for the
 *   next cycle (triggered by the periodic timer or a new scrobble).
 */
async function processScrobbles(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const api = getApi();
    if (!api) return;

    // Snapshot the queue – iterate over a copy so mutations don't
    // interfere with the loop.
    const pending = [...scrobbleStore.getState().pendingScrobbles];

    for (const item of pending) {
      let success = false;

      try {
        await api.scrobble({ id: item.songId, time: item.time, submission: true });
        success = true;
      } catch {
        // First attempt failed – retry once.
        try {
          await api.scrobble({ id: item.songId, time: item.time, submission: true });
          success = true;
        } catch {
          // Double failure – stop processing; timer will retry later.
          return;
        }
      }

      if (success) {
        scrobbleStore.getState().removeScrobble(item.id);
      }
    }
  } finally {
    isProcessing = false;
  }
}
