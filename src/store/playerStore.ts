/**
 * In-memory Zustand store for playback state.
 *
 * Updated by playerService event listeners so the UI stays in sync
 * with the native audio player, including across background/foreground
 * transitions.
 */

import { create } from 'zustand';

import type { Child } from '../services/subsonicService';

export type PlaybackStatus =
  | 'idle'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'loading'
  | 'stopped';

export interface PlayerState {
  /** The currently active track, or null when nothing is loaded. */
  currentTrack: Child | null;
  /** High-level playback state. */
  playbackState: PlaybackStatus;
  /** The full queue of Child objects currently loaded. */
  queue: Child[];

  /* ---- Setters (called by playerService) ---- */
  setCurrentTrack: (track: Child | null) => void;
  setPlaybackState: (state: PlaybackStatus) => void;
  setQueue: (queue: Child[]) => void;
}

export const playerStore = create<PlayerState>()((set) => ({
  currentTrack: null,
  playbackState: 'idle',
  queue: [],

  setCurrentTrack: (track) => set({ currentTrack: track }),
  setPlaybackState: (playbackState) => set({ playbackState }),
  setQueue: (queue) => set({ queue }),
}));
