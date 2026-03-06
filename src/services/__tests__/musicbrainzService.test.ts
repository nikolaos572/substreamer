const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

import {
  searchArtistMBID,
  searchArtists,
  getArtistBiography,
} from '../musicbrainzService';

beforeEach(() => {
  mockFetch.mockReset();
});

describe('searchArtistMBID', () => {
  it('returns the MBID of the first matching artist', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        artists: [{ id: 'mbid-123', name: 'Radiohead', score: 100 }],
      }),
    });
    const result = await searchArtistMBID('Radiohead');
    expect(result).toBe('mbid-123');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('artist%3ARadiohead');
    expect(url).toContain('limit=1');
  });

  it('returns null when no artists match', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ artists: [] }),
    });
    expect(await searchArtistMBID('nonexistent')).toBeNull();
  });

  it('returns null when artists field is undefined', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    expect(await searchArtistMBID('nobody')).toBeNull();
  });

  it('returns null on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });
    expect(await searchArtistMBID('Radiohead')).toBeNull();
  });

  it('returns null on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('network'));
    expect(await searchArtistMBID('Radiohead')).toBeNull();
  });
});

describe('searchArtists', () => {
  it('returns an array of matching artists', async () => {
    const artists = [
      { id: 'a1', name: 'Radiohead', score: 100 },
      { id: 'a2', name: 'Radio Dept.', score: 80 },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ artists }),
    });
    const result = await searchArtists('Radio');
    expect(result).toEqual(artists);
  });

  it('respects custom limit parameter', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ artists: [] }),
    });
    await searchArtists('Test', 5);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('limit=5');
  });

  it('returns empty array on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    expect(await searchArtists('Radiohead')).toEqual([]);
  });

  it('returns empty array on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('timeout'));
    expect(await searchArtists('Radiohead')).toEqual([]);
  });

  it('returns empty array when artists field is missing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    expect(await searchArtists('nobody')).toEqual([]);
  });
});

describe('getArtistBiography', () => {
  it('returns trimmed biography content', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        wikipediaExtract: { content: '  A famous band.  ' },
      }),
    });
    expect(await getArtistBiography('mbid-1')).toBe('A famous band.');
  });

  it('returns null when wikipediaExtract is missing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    expect(await getArtistBiography('mbid-1')).toBeNull();
  });

  it('returns null when content is empty', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        wikipediaExtract: { content: '   ' },
      }),
    });
    const result = await getArtistBiography('mbid-1');
    expect(result).toBe('');
  });

  it('returns null on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    expect(await getArtistBiography('mbid-1')).toBeNull();
  });

  it('returns null on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('network'));
    expect(await getArtistBiography('mbid-1')).toBeNull();
  });

  it('includes MBID in the URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ wikipediaExtract: { content: 'Bio' } }),
    });
    await getArtistBiography('abc-def-123');
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('abc-def-123');
    expect(url).toContain('wikipedia-extract');
  });
});
