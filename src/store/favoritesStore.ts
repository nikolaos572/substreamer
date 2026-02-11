import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  ensureCoverArtAuth,
  getStarred2,
  type AlbumID3,
  type ArtistID3,
  type Child,
} from '../services/subsonicService';

export interface FavoritesState {
  /** Starred songs */
  songs: Child[];
  /** Starred albums */
  albums: AlbumID3[];
  /** Starred artists */
  artists: ArtistID3[];
  /** Whether a fetch is currently in progress */
  loading: boolean;
  /** Last error message, if any */
  error: string | null;
  /** Timestamp of the last successful fetch */
  lastFetchedAt: number | null;

  /** Fetch all starred items from the server via getStarred2. */
  fetchStarred: () => Promise<void>;
  /** Clear all favorites data */
  clearFavorites: () => void;
}

const PERSIST_KEY = 'substreamer-favorites';

export const favoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      songs: [],
      albums: [],
      artists: [],
      loading: false,
      error: null,
      lastFetchedAt: null,

      fetchStarred: async () => {
        // Prevent duplicate fetches
        if (get().loading) return;

        set({ loading: true, error: null });
        try {
          await ensureCoverArtAuth();
          const { albums, artists, songs } = await getStarred2();

          set({
            songs,
            albums,
            artists,
            loading: false,
            lastFetchedAt: Date.now(),
          });
        } catch (e) {
          set({
            loading: false,
            error: e instanceof Error ? e.message : 'Failed to load favorites',
          });
        }
      },

      clearFavorites: () =>
        set({
          songs: [],
          albums: [],
          artists: [],
          loading: false,
          error: null,
          lastFetchedAt: null,
        }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        songs: state.songs,
        albums: state.albums,
        artists: state.artists,
        lastFetchedAt: state.lastFetchedAt,
      }),
    }
  )
);
