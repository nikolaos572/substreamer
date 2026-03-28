import { create } from 'zustand';

export type ShareTargetType = 'album' | 'playlist' | 'queue';

interface CreateShareState {
  visible: boolean;
  shareType: ShareTargetType;
  itemId: string | null;
  songIds: string[];
  itemName: string;
  coverArtId: string | null;

  showAlbum: (albumId: string, albumName: string, coverArtId?: string) => void;
  showPlaylist: (playlistId: string, playlistName: string, coverArtId?: string) => void;
  showQueue: (songIds: string[]) => void;
  hide: () => void;
}

export const createShareStore = create<CreateShareState>()((set) => ({
  visible: false,
  shareType: 'album',
  itemId: null,
  songIds: [],
  itemName: '',
  coverArtId: null,

  showAlbum: (albumId, albumName, coverArtId) =>
    set({
      visible: true,
      shareType: 'album',
      itemId: albumId,
      songIds: [],
      itemName: albumName,
      coverArtId: coverArtId ?? null,
    }),

  showPlaylist: (playlistId, playlistName, coverArtId) =>
    set({
      visible: true,
      shareType: 'playlist',
      itemId: playlistId,
      songIds: [],
      itemName: playlistName,
      coverArtId: coverArtId ?? null,
    }),

  showQueue: (songIds) =>
    set({
      visible: true,
      shareType: 'queue',
      itemId: null,
      songIds,
      itemName: 'Current Queue',
      coverArtId: null,
    }),

  hide: () =>
    set({
      visible: false,
      itemId: null,
      songIds: [],
      itemName: '',
      coverArtId: null,
    }),
}));
