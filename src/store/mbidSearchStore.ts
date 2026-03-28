import { create } from 'zustand';

interface MbidSearchState {
  visible: boolean;
  artistId: string | null;
  artistName: string | null;
  /** Currently assigned MBID to highlight in search results */
  currentMbid: string | null;
  coverArtId: string | null;

  show: (artistId: string, artistName: string, currentMbid: string | null, coverArtId?: string) => void;
  hide: () => void;
}

export const mbidSearchStore = create<MbidSearchState>()((set) => ({
  visible: false,
  artistId: null,
  artistName: null,
  currentMbid: null,
  coverArtId: null,

  show: (artistId, artistName, currentMbid, coverArtId) =>
    set({ visible: true, artistId, artistName, currentMbid, coverArtId: coverArtId ?? null }),
  hide: () =>
    set({ visible: false, artistId: null, artistName: null, currentMbid: null, coverArtId: null }),
}));
