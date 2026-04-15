import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { sqliteStorage } from './sqliteStorage';

import { cacheAllSizes, cacheEntityCoverArt } from '../services/imageCacheService';
import {
  ensureCoverArtAuth,
  getAlbum,
  type AlbumWithSongsID3,
} from '../services/subsonicService';
import { withTimeout } from '../utils/withTimeout';
import { ratingStore } from './ratingStore';

/** Hard budget for a single album-detail fetch. */
const FETCH_TIMEOUT_MS = 15_000;

export interface AlbumDetailEntry {
  album: AlbumWithSongsID3;
  /** Timestamp (Date.now()) when this entry was fetched from the server. */
  retrievedAt: number;
}

export interface AlbumDetailState {
  /** Album details indexed by album ID. */
  albums: Record<string, AlbumDetailEntry>;
  /** Fetch album from API, store it, and return it. Returns null on failure. */
  fetchAlbum: (id: string) => Promise<AlbumWithSongsID3 | null>;
  /** Clear all cached album details. */
  clearAlbums: () => void;
}

const PERSIST_KEY = 'substreamer-album-details';

export const albumDetailStore = create<AlbumDetailState>()(
  persist(
    (set, get) => ({
      albums: {},

      fetchAlbum: async (id: string) => {
        const result = await withTimeout(async () => {
          await ensureCoverArtAuth();
          const data = await getAlbum(id);
          if (data) {
            const ratingEntries: Array<{ id: string; serverRating: number }> = [
              { id: data.id, serverRating: data.userRating ?? 0 },
              ...(data.song ?? []).map((s) => ({ id: s.id, serverRating: s.userRating ?? 0 })),
            ];
            ratingStore.getState().reconcileRatings(ratingEntries);
            set({
              albums: {
                ...get().albums,
                [id]: { album: data, retrievedAt: Date.now() },
              },
            });

            // Proactively cache cover art for new IDs so they survive offline
            if (data.coverArt) cacheAllSizes(data.coverArt).catch(() => { /* non-critical */ });
            if (data.song?.length) cacheEntityCoverArt(data.song);
          }
          return data;
        }, FETCH_TIMEOUT_MS);

        return result === 'timeout' ? null : result;
      },

      clearAlbums: () => set({ albums: {} }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => sqliteStorage),
      partialize: (state) => ({
        albums: state.albums,
      }),
    }
  )
);
