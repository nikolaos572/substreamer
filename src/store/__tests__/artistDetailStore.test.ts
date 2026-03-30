jest.mock('../sqliteStorage', () => require('../__mocks__/sqliteStorage'));
jest.mock('../../services/subsonicService');
jest.mock('../../services/musicbrainzService');
jest.mock('../../utils/formatters', () => ({
  sanitizeBiographyText: jest.fn((text: string) => text),
}));

import {
  getArtist,
  getArtistInfo2,
  getTopSongs,
  VARIOUS_ARTISTS_BIO,
  VARIOUS_ARTISTS_COVER_ART_ID,
} from '../../services/subsonicService';
import {
  getArtistBiography,
  searchArtistMBID,
} from '../../services/musicbrainzService';
import { mbidOverrideStore } from '../mbidOverrideStore';
import { artistDetailStore } from '../artistDetailStore';

const mockGetArtist = getArtist as jest.MockedFunction<typeof getArtist>;
const mockGetArtistInfo2 = getArtistInfo2 as jest.MockedFunction<typeof getArtistInfo2>;
const mockGetTopSongs = getTopSongs as jest.MockedFunction<typeof getTopSongs>;
const mockSearchMBID = searchArtistMBID as jest.MockedFunction<typeof searchArtistMBID>;
const mockGetBio = getArtistBiography as jest.MockedFunction<typeof getArtistBiography>;

beforeEach(() => {
  jest.clearAllMocks();
  artistDetailStore.getState().clearArtists();
  mbidOverrideStore.setState({ overrides: {} });
  mockGetArtist.mockResolvedValue(null);
  mockGetArtistInfo2.mockResolvedValue(null);
  mockGetTopSongs.mockResolvedValue([]);
});

describe('fetchArtist — Various Artists', () => {
  it('returns static entry with branded coverArt and bio', async () => {
    mockGetArtist.mockResolvedValue({
      id: 'va-1',
      name: 'Various Artists',
      albumCount: 5,
      album: [],
    } as any);

    const entry = await artistDetailStore.getState().fetchArtist('va-1');

    expect(entry).not.toBeNull();
    expect(entry!.artist.coverArt).toBe(VARIOUS_ARTISTS_COVER_ART_ID);
    expect(entry!.biography).toBe(VARIOUS_ARTISTS_BIO);
    expect(entry!.topSongs).toEqual([]);
    expect(entry!.artistInfo).toBeNull();
    expect(entry!.resolvedMbid).toBeNull();
  });

  it('does not call getArtistInfo2 or getTopSongs for Various Artists', async () => {
    mockGetArtist.mockResolvedValue({
      id: 'va-1',
      name: 'Various Artists',
      albumCount: 3,
      album: [],
    } as any);

    await artistDetailStore.getState().fetchArtist('va-1');

    expect(mockGetArtistInfo2).not.toHaveBeenCalled();
    expect(mockGetTopSongs).not.toHaveBeenCalled();
  });

  it('handles case-insensitive Various Artists name', async () => {
    mockGetArtist.mockResolvedValue({
      id: 'va-1',
      name: 'various artists',
      albumCount: 1,
      album: [],
    } as any);

    const entry = await artistDetailStore.getState().fetchArtist('va-1');

    expect(entry).not.toBeNull();
    expect(entry!.artist.coverArt).toBe(VARIOUS_ARTISTS_COVER_ART_ID);
    expect(mockGetArtistInfo2).not.toHaveBeenCalled();
  });

  it('stores the entry in the artists map', async () => {
    mockGetArtist.mockResolvedValue({
      id: 'va-1',
      name: 'Various Artists',
      albumCount: 2,
      album: [],
    } as any);

    await artistDetailStore.getState().fetchArtist('va-1');

    const stored = artistDetailStore.getState().artists['va-1'];
    expect(stored).toBeDefined();
    expect(stored.artist.coverArt).toBe(VARIOUS_ARTISTS_COVER_ART_ID);
  });
});

describe('fetchArtist — normal artist', () => {
  it('calls getArtistInfo2 and getTopSongs in parallel', async () => {
    mockGetArtist.mockResolvedValue({
      id: 'ar-1',
      name: 'Radiohead',
      albumCount: 9,
      album: [],
    } as any);
    mockGetArtistInfo2.mockResolvedValue({ biography: 'A band from Oxford.' } as any);
    mockGetTopSongs.mockResolvedValue([{ id: 's1', title: 'Creep' }] as any);

    const entry = await artistDetailStore.getState().fetchArtist('ar-1');

    expect(entry).not.toBeNull();
    expect(mockGetArtistInfo2).toHaveBeenCalledWith('ar-1');
    expect(mockGetTopSongs).toHaveBeenCalledWith('Radiohead', 20);
    expect(entry!.topSongs).toHaveLength(1);
    expect(entry!.biography).toBe('A band from Oxford.');
  });

  it('returns null when getArtist fails', async () => {
    mockGetArtist.mockResolvedValue(null);

    const entry = await artistDetailStore.getState().fetchArtist('ar-1');

    expect(entry).toBeNull();
    expect(mockGetArtistInfo2).not.toHaveBeenCalled();
    expect(mockGetTopSongs).not.toHaveBeenCalled();
  });

  it('falls back to getTopSongs empty array when getTopSongs throws', async () => {
    mockGetArtist.mockResolvedValue({
      id: 'ar-1',
      name: 'Radiohead',
      albumCount: 9,
      album: [],
    } as any);
    mockGetArtistInfo2.mockResolvedValue({ biography: 'Bio text.' } as any);
    mockGetTopSongs.mockRejectedValue(new Error('fail'));

    const entry = await artistDetailStore.getState().fetchArtist('ar-1');

    expect(entry).not.toBeNull();
    expect(entry!.topSongs).toEqual([]);
  });
});

describe('fetchArtist — MusicBrainz biography fallback', () => {
  const setupArtist = () => {
    mockGetArtist.mockResolvedValue({
      id: 'ar-1',
      name: 'Radiohead',
      albumCount: 9,
      album: [],
    } as any);
  };

  it('uses MBID override for bio when Subsonic has no bio', async () => {
    setupArtist();
    mockGetArtistInfo2.mockResolvedValue({ biography: '' } as any);
    mbidOverrideStore.setState({
      overrides: { 'artist:ar-1': { type: 'artist', entityId: 'ar-1', entityName: 'Radiohead', mbid: 'override-mbid' } },
    });
    mockGetBio.mockResolvedValue('MusicBrainz bio from override.');

    const entry = await artistDetailStore.getState().fetchArtist('ar-1');

    expect(entry!.biography).toBe('MusicBrainz bio from override.');
    expect(entry!.resolvedMbid).toBe('override-mbid');
    expect(mockGetBio).toHaveBeenCalledWith('override-mbid');
  });

  it('uses server musicBrainzId when no override and no Subsonic bio', async () => {
    setupArtist();
    mockGetArtistInfo2.mockResolvedValue({
      biography: '',
      musicBrainzId: 'server-mbid',
    } as any);
    mbidOverrideStore.setState({ overrides: {} });
    mockGetBio.mockResolvedValue('MusicBrainz bio from server.');

    const entry = await artistDetailStore.getState().fetchArtist('ar-1');

    expect(entry!.biography).toBe('MusicBrainz bio from server.');
    expect(entry!.resolvedMbid).toBe('server-mbid');
  });

  it('auto-searches MBID when no override, no server MBID, no Subsonic bio', async () => {
    setupArtist();
    mockGetArtistInfo2.mockResolvedValue({ biography: '' } as any);
    mbidOverrideStore.setState({ overrides: {} });
    mockSearchMBID.mockResolvedValue('auto-mbid');
    mockGetBio.mockResolvedValue('Auto-searched bio.');

    const entry = await artistDetailStore.getState().fetchArtist('ar-1');

    expect(mockSearchMBID).toHaveBeenCalledWith('Radiohead');
    expect(entry!.biography).toBe('Auto-searched bio.');
    expect(entry!.resolvedMbid).toBe('auto-mbid');
  });

  it('returns null biography when auto-search finds no MBID', async () => {
    setupArtist();
    mockGetArtistInfo2.mockResolvedValue({ biography: '' } as any);
    mbidOverrideStore.setState({ overrides: {} });
    mockSearchMBID.mockResolvedValue(null);

    const entry = await artistDetailStore.getState().fetchArtist('ar-1');

    expect(entry!.biography).toBeNull();
    expect(entry!.resolvedMbid).toBeNull();
  });

  it('returns null biography when MusicBrainz bio fetch returns null', async () => {
    setupArtist();
    mockGetArtistInfo2.mockResolvedValue({ biography: '' } as any);
    mbidOverrideStore.setState({ overrides: {} });
    mockSearchMBID.mockResolvedValue('some-mbid');
    mockGetBio.mockResolvedValue(null);

    const entry = await artistDetailStore.getState().fetchArtist('ar-1');

    expect(entry!.biography).toBeNull();
    expect(entry!.resolvedMbid).toBe('some-mbid');
  });

  it('catches MusicBrainz errors and still returns entry', async () => {
    setupArtist();
    mockGetArtistInfo2.mockResolvedValue({ biography: '' } as any);
    mbidOverrideStore.setState({ overrides: {} });
    mockSearchMBID.mockRejectedValue(new Error('MusicBrainz down'));

    const entry = await artistDetailStore.getState().fetchArtist('ar-1');

    expect(entry).not.toBeNull();
    expect(entry!.biography).toBeNull();
    expect(entry!.resolvedMbid).toBeNull();
  });

  it('resolvedMbid uses override when Subsonic bio is present', async () => {
    setupArtist();
    mockGetArtistInfo2.mockResolvedValue({
      biography: 'Subsonic bio exists.',
      musicBrainzId: 'server-mbid',
    } as any);
    mbidOverrideStore.setState({
      overrides: { 'artist:ar-1': { type: 'artist', entityId: 'ar-1', entityName: 'Radiohead', mbid: 'override-mbid' } },
    });

    const entry = await artistDetailStore.getState().fetchArtist('ar-1');

    expect(entry!.biography).toBe('Subsonic bio exists.');
    expect(entry!.resolvedMbid).toBe('override-mbid');
  });
});
