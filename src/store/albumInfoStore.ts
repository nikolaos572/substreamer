import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getOverride, mbidOverrideStore } from './mbidOverrideStore';
import { sqliteStorage } from './sqliteStorage';

import { getAlbumInfo2, type AlbumInfo } from '../services/subsonicService';
import { getAlbumDescription } from '../services/musicbrainzService';
import { sanitizeBiographyText } from '../utils/formatters';

interface AlbumInfoEntry {
  albumInfo: AlbumInfo;
  /** Wikipedia description if enriched client-side (server had no notes). */
  enrichedNotes: string | null;
  /** Attribution URL for the enriched notes (Wikipedia page). */
  enrichedNotesUrl: string | null;
  /** The MBID override for this album (release-group ID), or null if using server MBID. */
  overrideMbid: string | null;
  /** Timestamp (Date.now()) when this entry was fetched from the server. */
  retrievedAt: number;
}

interface AlbumInfoState {
  /** Album info indexed by album ID. */
  entries: Record<string, AlbumInfoEntry>;
  /** Per-album loading flags (not persisted). */
  loading: Record<string, boolean>;
  /**
   * Fetch album info from the Subsonic server, enriching with Wikipedia if
   * the server returns no notes. Pass artistName and albumName so the
   * MusicBrainz search fallback can resolve the album.
   */
  fetchAlbumInfo: (
    albumId: string,
    artistName?: string,
    albumName?: string,
  ) => Promise<AlbumInfoEntry | null>;
  /** Clear all cached album info. */
  clearAlbumInfo: () => void;
}

const PERSIST_KEY = 'substreamer-album-info';

export const albumInfoStore = create<AlbumInfoState>()(
  persist(
    (set, get) => ({
      entries: {},
      loading: {},

      fetchAlbumInfo: async (
        albumId: string,
        artistName?: string,
        albumName?: string,
      ) => {
        set({ loading: { ...get().loading, [albumId]: true } });
        try {
          const data = await getAlbumInfo2(albumId);

          // Check if the server returned meaningful notes
          const serverNotes = data?.notes ? sanitizeBiographyText(data.notes) : '';
          const hasServerNotes = serverNotes.length > 0;

          let enrichedNotes: string | null = null;
          let enrichedNotesUrl: string | null = null;

          // Check for an MBID override (release-group ID from user selection)
          const overrideMbid = getOverride(
            mbidOverrideStore.getState().overrides,
            'album',
            albumId,
          )?.mbid ?? null;

          if (!hasServerNotes && artistName && albumName) {
            try {
              const mbidToUse = overrideMbid ?? data?.musicBrainzId;
              const result = await getAlbumDescription(
                artistName,
                albumName,
                mbidToUse,
                // Override MBIDs are release-group IDs; server MBIDs are release IDs
                !!overrideMbid,
              );
              if (result) {
                enrichedNotes = result.description;
                enrichedNotesUrl = result.url;
              }
            } catch {
              /* non-critical: enrichment is best-effort */
            }
          }

          const entry: AlbumInfoEntry = {
            albumInfo: data ?? {},
            enrichedNotes,
            enrichedNotesUrl,
            overrideMbid,
            retrievedAt: Date.now(),
          };

          set({
            entries: { ...get().entries, [albumId]: entry },
          });

          return entry;
        } finally {
          const { [albumId]: _, ...rest } = get().loading;
          set({ loading: rest });
        }
      },

      clearAlbumInfo: () => set({ entries: {}, loading: {} }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => sqliteStorage),
      partialize: (state) => ({
        entries: state.entries,
      }),
    }
  )
);
