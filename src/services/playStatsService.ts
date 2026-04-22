/**
 * Eager local-play-stats updater.
 *
 * When a scrobble fires (song played to completion, exclusions passed), we
 * mutate the local copies of the song and its album everywhere they live so
 * the UI reflects the new play count + last-played date without waiting for
 * a server round-trip. Pull-to-refresh on any of these stores replaces the
 * local blob with the server response, so reconciliation is automatic: if
 * the server is ahead, the local values are overwritten; if the server is
 * still catching up, the local eager values carry until the next refresh.
 *
 * This module has a single public entry point, `applyLocalPlay(song)`, that
 * fans out to every store that may hold a copy of the row. Stores no-op
 * when the row isn't present — there is nothing to update, hence nothing to
 * go stale.
 */

import { albumDetailStore } from '../store/albumDetailStore';
import { albumLibraryStore } from '../store/albumLibraryStore';
import { artistDetailStore } from '../store/artistDetailStore';
import { favoritesStore } from '../store/favoritesStore';
import { playlistDetailStore } from '../store/playlistDetailStore';
import { applyLocalPlayToPlayer } from './playerService';
import { type Child } from './subsonicService';

/**
 * Eagerly bump local play-count and last-played for a just-scrobbled song.
 * Safe to call repeatedly — each store's action is idempotent per input.
 * Called from `scrobbleService.addCompletedScrobble` after the exclusion
 * gate so excluded plays skip the update automatically.
 */
export function applyLocalPlay(song: Child): void {
  const now = new Date().toISOString();
  const songId = song.id;
  const albumId = song.albumId;

  // Persistent stores that hold this song's metadata.
  albumDetailStore.getState().applyLocalPlay(songId, albumId, now);
  playlistDetailStore.getState().applyLocalPlay(songId, now);
  favoritesStore.getState().applyLocalPlay(songId, albumId, now);
  albumLibraryStore.getState().applyLocalPlay(albumId, now);
  artistDetailStore.getState().applyLocalPlay(songId, albumId, now);

  // Ephemeral player state — the currently-displayed track copy.
  applyLocalPlayToPlayer(songId, now);
}
