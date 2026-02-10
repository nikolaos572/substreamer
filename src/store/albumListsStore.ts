import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  ensureCoverArtAuth,
  getFrequentlyPlayedAlbums,
  getRandomAlbums,
  getRecentlyAddedAlbums,
  getRecentlyPlayedAlbums,
  type AlbumID3,
} from '../services/subsonicService';

const SIZE_HOME = 20;

export type AlbumListType =
  | 'recentlyAdded'
  | 'recentlyPlayed'
  | 'frequentlyPlayed'
  | 'randomSelection';

export interface AlbumListsState {
  recentlyAdded: AlbumID3[];
  recentlyPlayed: AlbumID3[];
  frequentlyPlayed: AlbumID3[];
  randomSelection: AlbumID3[];
  setRecentlyAdded: (albums: AlbumID3[]) => void;
  setRecentlyPlayed: (albums: AlbumID3[]) => void;
  setFrequentlyPlayed: (albums: AlbumID3[]) => void;
  setRandomSelection: (albums: AlbumID3[]) => void;
  refreshRecentlyAdded: () => Promise<void>;
  refreshRecentlyPlayed: () => Promise<void>;
  refreshFrequentlyPlayed: () => Promise<void>;
  refreshRandomSelection: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const PERSIST_KEY = 'substreamer-album-lists';

export const albumListsStore = create<AlbumListsState>()(
  persist(
    (set, get) => ({
      recentlyAdded: [],
      recentlyPlayed: [],
      frequentlyPlayed: [],
      randomSelection: [],

      setRecentlyAdded: (albums) => set({ recentlyAdded: albums }),
      setRecentlyPlayed: (albums) => set({ recentlyPlayed: albums }),
      setFrequentlyPlayed: (albums) => set({ frequentlyPlayed: albums }),
      setRandomSelection: (albums) => set({ randomSelection: albums }),

      refreshRecentlyAdded: async () => {
        try {
          await ensureCoverArtAuth();
          const albums = await getRecentlyAddedAlbums(SIZE_HOME);
          set({ recentlyAdded: albums });
        } catch {
          set({ recentlyAdded: [] });
        }
      },

      refreshRecentlyPlayed: async () => {
        try {
          await ensureCoverArtAuth();
          const albums = await getRecentlyPlayedAlbums(SIZE_HOME);
          set({ recentlyPlayed: albums });
        } catch {
          set({ recentlyPlayed: [] });
        }
      },

      refreshFrequentlyPlayed: async () => {
        try {
          await ensureCoverArtAuth();
          const albums = await getFrequentlyPlayedAlbums(SIZE_HOME);
          set({ frequentlyPlayed: albums });
        } catch {
          set({ frequentlyPlayed: [] });
        }
      },

      refreshRandomSelection: async () => {
        try {
          await ensureCoverArtAuth();
          const albums = await getRandomAlbums(SIZE_HOME);
          set({ randomSelection: albums });
        } catch {
          set({ randomSelection: [] });
        }
      },

      refreshAll: async () => {
        try {
          await ensureCoverArtAuth();
          const [recentlyAdded, recentlyPlayed, frequentlyPlayed, randomSelection] =
            await Promise.all([
              getRecentlyAddedAlbums(SIZE_HOME),
              getRecentlyPlayedAlbums(SIZE_HOME),
              getFrequentlyPlayedAlbums(SIZE_HOME),
              getRandomAlbums(SIZE_HOME),
            ]);
          set({
            recentlyAdded,
            recentlyPlayed,
            frequentlyPlayed,
            randomSelection,
          });
        } catch {
          // Leave existing state on full refresh failure
        }
      },
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        recentlyAdded: state.recentlyAdded,
        recentlyPlayed: state.recentlyPlayed,
        frequentlyPlayed: state.frequentlyPlayed,
        randomSelection: state.randomSelection,
      }),
    }
  )
);
