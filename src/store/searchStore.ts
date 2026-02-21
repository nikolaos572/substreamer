import { create } from 'zustand';

import {
  ensureCoverArtAuth,
  search3,
  type AlbumID3,
  type ArtistID3,
  type Child,
} from '../services/subsonicService';
import { albumLibraryStore } from './albumLibraryStore';
import { musicCacheStore } from './musicCacheStore';
import { offlineModeStore } from './offlineModeStore';
import { playlistLibraryStore } from './playlistLibraryStore';

export interface SearchResults {
  albums: AlbumID3[];
  artists: ArtistID3[];
  songs: Child[];
}

const EMPTY_RESULTS: SearchResults = {
  albums: [],
  artists: [],
  songs: [],
};

function performOfflineSearch(query: string): SearchResults {
  const q = query.toLowerCase();
  const { cachedItems } = musicCacheStore.getState();

  const cachedIds = new Set(Object.keys(cachedItems));

  const albums = albumLibraryStore
    .getState()
    .albums.filter(
      (a) =>
        cachedIds.has(a.id) &&
        (a.name.toLowerCase().includes(q) ||
          (a.artist?.toLowerCase().includes(q) ?? false))
    );

  const playlists = playlistLibraryStore
    .getState()
    .playlists.filter(
      (p) => cachedIds.has(p.id) && p.name.toLowerCase().includes(q)
    );

  // Construct minimal Child objects for playlist results so they appear in
  // the albums section (Subsonic search3 doesn't return playlists either,
  // so we merge them as album-shaped results).
  const playlistAlbums: AlbumID3[] = playlists.map((p) => ({
    id: p.id,
    name: p.name,
    artist: p.owner,
    coverArt: p.coverArt,
    songCount: p.songCount,
    duration: p.duration,
    created: p.created,
  }));

  const songs: Child[] = [];
  for (const item of Object.values(cachedItems)) {
    for (const track of item.tracks) {
      if (
        track.title.toLowerCase().includes(q) ||
        track.artist.toLowerCase().includes(q)
      ) {
        songs.push({
          id: track.id,
          title: track.title,
          artist: track.artist,
          album: item.name,
          duration: track.duration,
          isDir: false,
          coverArt: item.coverArtId,
        });
      }
    }
  }

  return {
    albums: [...albums, ...playlistAlbums],
    artists: [],
    songs,
  };
}

export interface SearchState {
  /** Current search query text */
  query: string;
  /** Full search results from the server */
  results: SearchResults;
  /** Whether a search request is in progress */
  loading: boolean;
  /** Last error message, if any */
  error: string | null;
  /** Whether the overlay dropdown is visible */
  isOverlayVisible: boolean;
  /** Height of the header (set by SearchableHeader via onLayout) */
  headerHeight: number;

  /** Update the query text */
  setQuery: (query: string) => void;
  /** Execute a search using the current query */
  performSearch: () => Promise<void>;
  /** Show the results overlay */
  showOverlay: () => void;
  /** Hide the results overlay */
  hideOverlay: () => void;
  /** Set measured header height */
  setHeaderHeight: (height: number) => void;
  /** Clear query, results, and hide overlay */
  clear: () => void;
}

export const searchStore = create<SearchState>()((set, get) => ({
  query: '',
  results: EMPTY_RESULTS,
  loading: false,
  error: null,
  isOverlayVisible: false,
  headerHeight: 0,

  setQuery: (query) => set({ query }),

  performSearch: async () => {
    const { query } = get();
    if (!query.trim()) {
      set({ results: EMPTY_RESULTS, loading: false, error: null });
      return;
    }

    if (offlineModeStore.getState().offlineMode) {
      const results = performOfflineSearch(query.trim());
      set({ results, loading: false, error: null });
      return;
    }

    set({ loading: true, error: null });
    try {
      await ensureCoverArtAuth();
      const results = await search3(query);
      set({ results, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : 'Search failed',
      });
    }
  },

  showOverlay: () => set({ isOverlayVisible: true }),
  hideOverlay: () => set({ isOverlayVisible: false }),
  setHeaderHeight: (headerHeight) => set({ headerHeight }),

  clear: () =>
    set({
      query: '',
      results: EMPTY_RESULTS,
      loading: false,
      error: null,
      isOverlayVisible: false,
    }),
}));
