import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { sqliteStorage } from './sqliteStorage';

export type ItemLayout = 'list' | 'grid';
export type AlbumSortOrder = 'artist' | 'title';
export type ArtistAlbumSortOrder = 'newest' | 'oldest';
export type DateFormat = 'yyyy/mm/dd' | 'yyyy/dd/mm';

export interface LayoutPreferencesState {
  albumLayout: ItemLayout;
  artistLayout: ItemLayout;
  playlistLayout: ItemLayout;
  favSongLayout: ItemLayout;
  favAlbumLayout: ItemLayout;
  favArtistLayout: ItemLayout;
  albumSortOrder: AlbumSortOrder;
  artistAlbumSortOrder: ArtistAlbumSortOrder;
  dateFormat: DateFormat;
  setAlbumLayout: (layout: ItemLayout) => void;
  setArtistLayout: (layout: ItemLayout) => void;
  setPlaylistLayout: (layout: ItemLayout) => void;
  setFavSongLayout: (layout: ItemLayout) => void;
  setFavAlbumLayout: (layout: ItemLayout) => void;
  setFavArtistLayout: (layout: ItemLayout) => void;
  setAlbumSortOrder: (order: AlbumSortOrder) => void;
  setArtistAlbumSortOrder: (order: ArtistAlbumSortOrder) => void;
  setDateFormat: (format: DateFormat) => void;
}

const PERSIST_KEY = 'substreamer-layout-preferences';

export const layoutPreferencesStore = create<LayoutPreferencesState>()(
  persist(
    (set) => ({
      albumLayout: 'list',
      artistLayout: 'list',
      playlistLayout: 'list',
      favSongLayout: 'list',
      favAlbumLayout: 'list',
      favArtistLayout: 'list',
      albumSortOrder: 'artist',
      artistAlbumSortOrder: 'newest',
      dateFormat: 'yyyy/mm/dd',
      setAlbumLayout: (albumLayout) => set({ albumLayout }),
      setArtistLayout: (artistLayout) => set({ artistLayout }),
      setPlaylistLayout: (playlistLayout) => set({ playlistLayout }),
      setFavSongLayout: (favSongLayout) => set({ favSongLayout }),
      setFavAlbumLayout: (favAlbumLayout) => set({ favAlbumLayout }),
      setFavArtistLayout: (favArtistLayout) => set({ favArtistLayout }),
      setAlbumSortOrder: (albumSortOrder) => set({ albumSortOrder }),
      setArtistAlbumSortOrder: (artistAlbumSortOrder) =>
        set({ artistAlbumSortOrder }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => sqliteStorage),
      partialize: (state) => ({
        albumLayout: state.albumLayout,
        artistLayout: state.artistLayout,
        playlistLayout: state.playlistLayout,
        favSongLayout: state.favSongLayout,
        favAlbumLayout: state.favAlbumLayout,
        favArtistLayout: state.favArtistLayout,
        albumSortOrder: state.albumSortOrder,
        artistAlbumSortOrder: state.artistAlbumSortOrder,
        dateFormat: state.dateFormat,
      }),
    }
  )
);
