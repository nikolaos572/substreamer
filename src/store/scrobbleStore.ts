import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface PendingScrobble {
  /** Unique identifier for this pending scrobble entry. */
  id: string;
  /** Subsonic song ID to submit. */
  songId: string;
  /** Unix timestamp (ms) when playback completed. */
  time: number;
}

export interface ScrobbleState {
  pendingScrobbles: PendingScrobble[];

  addScrobble: (songId: string, time: number) => void;
  removeScrobble: (id: string) => void;
}

const PERSIST_KEY = 'substreamer-scrobbles';

export const scrobbleStore = create<ScrobbleState>()(
  persist(
    (set) => ({
      pendingScrobbles: [],

      addScrobble: (songId, time) =>
        set((state) => ({
          pendingScrobbles: [
            ...state.pendingScrobbles,
            { id: `${time}-${Math.random().toString(36).slice(2, 8)}`, songId, time },
          ],
        })),

      removeScrobble: (id) =>
        set((state) => ({
          pendingScrobbles: state.pendingScrobbles.filter((s) => s.id !== id),
        })),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        pendingScrobbles: state.pendingScrobbles,
      }),
    }
  )
);
