import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface AuthState {
  serverUrl: string | null;
  username: string | null;
  password: string | null;
  apiVersion: string | null;
  isLoggedIn: boolean;
  rehydrated: boolean;
  setSession: (
    serverUrl: string,
    username: string,
    password: string,
    apiVersion: string
  ) => void;
  clearSession: () => void;
  setRehydrated: (value: boolean) => void;
}

const PERSIST_KEY = 'substreamer-auth';

/**
 * Temporary: clears all persisted auth data (AsyncStorage + in-memory state).
 * Remove this when no longer needed for development.
 */
export async function clearPersistedData(): Promise<void> {
  const debug = false;
  if (debug) {
  await AsyncStorage.removeItem(PERSIST_KEY);
  authStore.getState().clearSession();
  } else {
    return Promise.resolve();
  }
}

export const authStore = create<AuthState>()(
  persist(
    (set) => ({
      serverUrl: null,
      username: null,
      password: null,
      apiVersion: null,
      isLoggedIn: false,
      rehydrated: false,

      setSession: (serverUrl, username, password, apiVersion) =>
        set({
          serverUrl,
          username,
          password,
          apiVersion,
          isLoggedIn: true,
        }),

      clearSession: () =>
        set({
          serverUrl: null,
          username: null,
          password: null,
          apiVersion: null,
          isLoggedIn: false,
        }),

      setRehydrated: (value) => set({ rehydrated: value }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        serverUrl: state.serverUrl,
        username: state.username,
        password: state.password,
        apiVersion: state.apiVersion,
        isLoggedIn: state.isLoggedIn,
      }),
    }
  )
);
