/**
 * MusicBrainz API service.
 *
 * Provides helpers to resolve an artist MBID (MusicBrainz ID) by name and to
 * fetch a Wikipedia-sourced biography for a given MBID.
 *
 * Rate-limit note: MusicBrainz enforces a maximum of ~1 request per second.
 * These functions are typically called once per artist detail view, so no
 * client-side throttle is implemented here. If usage increases, add a rate
 * limiter (e.g. a simple delay queue).
 */

const API_BASE_URL = 'https://musicbrainz.org/ws/2/';
const WEB_BASE_URL = 'https://musicbrainz.org/artist/';
const WIKIDATA_API_URL = 'https://www.wikidata.org/w/api.php';
const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const USER_AGENT = 'Substreamer/1.0.0 (https://github.com/substreamer)';

// ── Types ───────────────────────────────────────────────────────────────────

/** Shape of a single artist entry returned by the MusicBrainz search API. */
export interface MusicBrainzArtist {
  id: string;
  name: string;
  score?: number;
  type?: string;
  country?: string;
  disambiguation?: string;
}

/** Top-level response from the MusicBrainz artist search endpoint. */
export interface MusicBrainzArtistSearchResult {
  created: string;
  count: number;
  offset: number;
  artists: MusicBrainzArtist[];
}

/** Shape of the Wikipedia extract object returned by MusicBrainz. */
export interface WikipediaExtract {
  canonical?: string;
  title?: string;
  content?: string;
  language?: string;
  url?: string;
}

/** Response from the MusicBrainz Wikipedia extract endpoint. */
interface WikipediaExtractResponse {
  wikipediaExtract?: WikipediaExtract;
}

// ── Functions ───────────────────────────────────────────────────────────────

/**
 * Search for an artist by name and return the best-matching MBID.
 *
 * Uses the MusicBrainz search API with `limit=1` to retrieve the single
 * highest-scoring match.
 *
 * @param artistName  The artist name to search for.
 * @returns The MBID string, or `null` if no match is found or an error occurs.
 */
export async function searchArtistMBID(
  artistName: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const query = `artist:${artistName}`;
    const url = `${API_BASE_URL}artist/?query=${encodeURIComponent(query)}&fmt=json&limit=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal,
    });

    if (!response.ok) return null;

    const data: MusicBrainzArtistSearchResult = await response.json();

    if (data.artists && data.artists.length > 0) {
      return data.artists[0].id;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Search for artists by name and return multiple results for user selection.
 *
 * @param query  The artist name / search query.
 * @param limit  Maximum number of results (default 10).
 * @returns Array of matching artists, or empty array on failure.
 */
export async function searchArtists(
  query: string,
  limit = 10,
  signal?: AbortSignal,
): Promise<MusicBrainzArtist[]> {
  try {
    const url = `${API_BASE_URL}artist/?query=${encodeURIComponent(`artist:${query}`)}&fmt=json&limit=${limit}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal,
    });

    if (!response.ok) return [];

    const data: MusicBrainzArtistSearchResult = await response.json();

    return data.artists ?? [];
  } catch {
    return [];
  }
}

/**
 * Fetch the Wikipedia biography for an artist by their MBID.
 *
 * Uses the MusicBrainz website's `/wikipedia-extract` endpoint which returns
 * a plain-text extract sourced from Wikipedia.
 *
 * @param mbid  The MusicBrainz ID of the artist.
 * @returns The biography text, or `null` if unavailable or an error occurs.
 */
export async function getArtistBiography(
  mbid: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const url = encodeURI(`${WEB_BASE_URL}${mbid}/wikipedia-extract`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal,
    });

    if (!response.ok) return null;

    const data: WikipediaExtractResponse = await response.json();

    return data.wikipediaExtract?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

// ── Album description enrichment ──────────────────────────────────────────
//
// MusicBrainz's /wikipedia-extract endpoint only works for artists, not
// release-groups. For albums we follow a multi-step pipeline:
//   1. Search MusicBrainz for the release-group MBID (or use one provided)
//   2. Fetch url-rels for the release-group → extract Wikidata Q-number
//   3. Query Wikidata sitelinks → resolve English Wikipedia article title
//   4. Fetch the article extract via the Wikipedia REST API

/** Shape of a release-group entry returned by the MusicBrainz search API. */
export interface MusicBrainzReleaseGroup {
  id: string;
  title: string;
  score?: number;
  'primary-type'?: string;
  'first-release-date'?: string;
  'artist-credit'?: Array<{ name: string; artist: { id: string; name: string } }>;
}

/** Top-level response from the MusicBrainz release-group search endpoint. */
interface MusicBrainzReleaseGroupSearchResult {
  'release-groups'?: MusicBrainzReleaseGroup[];
}

/** A URL relation returned by the MusicBrainz API. */
interface MusicBrainzUrlRelation {
  type: string;
  url?: { resource: string };
}

/** Shape of a release-group lookup with url-rels. */
interface MusicBrainzReleaseGroupWithRels {
  id: string;
  relations?: MusicBrainzUrlRelation[];
}

/**
 * Search MusicBrainz for a release-group matching an artist + album name.
 *
 * @returns The best-matching release-group MBID, or `null`.
 */
export async function searchReleaseGroupMBID(
  artist: string,
  album: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const query = `releasegroup:${album} AND artist:${artist}`;
    const url = `${API_BASE_URL}release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=1`;

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal,
    });

    if (!response.ok) return null;

    const data: MusicBrainzReleaseGroupSearchResult = await response.json();
    const groups = data['release-groups'];
    return groups && groups.length > 0 ? groups[0].id : null;
  } catch {
    return null;
  }
}

/**
 * Search for release-groups and return multiple results for user selection.
 *
 * @param query   The album name / search query.
 * @param artist  Optional artist name to narrow results.
 * @param limit   Maximum number of results (default 10).
 * @returns Array of matching release-groups, or empty array on failure.
 */
export async function searchReleaseGroups(
  query: string,
  artist?: string,
  limit = 10,
  signal?: AbortSignal,
): Promise<MusicBrainzReleaseGroup[]> {
  try {
    const parts = [`releasegroup:${query}`];
    if (artist) parts.push(`AND artist:${artist}`);
    const url = `${API_BASE_URL}release-group/?query=${encodeURIComponent(parts.join(' '))}&fmt=json&limit=${limit}`;

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal,
    });

    if (!response.ok) return [];

    const data: MusicBrainzReleaseGroupSearchResult = await response.json();
    return data['release-groups'] ?? [];
  } catch {
    return [];
  }
}

/**
 * Resolve a release MBID to its parent release-group MBID.
 *
 * Subsonic servers (e.g. Navidrome) return release MBIDs, not release-group
 * MBIDs. This function looks up the release and extracts the release-group ID,
 * which is needed for the Wikidata → Wikipedia pipeline.
 *
 * @param releaseMbid  The MusicBrainz release ID.
 * @returns The release-group MBID, or `null`.
 */
export async function getReleaseGroupIdForRelease(
  releaseMbid: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const url = `${API_BASE_URL}release/${encodeURIComponent(releaseMbid)}?inc=release-groups&fmt=json`;

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal,
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data?.['release-group']?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch the Wikidata Q-number for a release-group via its URL relationships.
 *
 * @param mbid  The MusicBrainz release-group ID.
 * @returns The Wikidata Q-number (e.g. "Q202996"), or `null`.
 */
export async function getWikidataIdForReleaseGroup(
  mbid: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const url = `${API_BASE_URL}release-group/${encodeURIComponent(mbid)}?inc=url-rels&fmt=json`;

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal,
    });

    if (!response.ok) return null;

    const data: MusicBrainzReleaseGroupWithRels = await response.json();
    const wikidataRel = data.relations?.find((r) => r.type === 'wikidata');
    if (!wikidataRel?.url?.resource) return null;

    // Extract Q-number from URL like "https://www.wikidata.org/wiki/Q202996"
    const match = wikidataRel.url.resource.match(/\/(Q\d+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a Wikidata entity to a Wikipedia article extract.
 *
 * Uses the Wikidata sitelinks API to find the English Wikipedia article title,
 * then fetches the article summary via the Wikipedia REST API.
 *
 * @param wikidataId  The Wikidata Q-number (e.g. "Q202996").
 * @returns An object with `extract` (plain text) and `url` (Wikipedia page), or `null`.
 */
export async function getWikipediaExtractForAlbum(
  wikidataId: string,
  signal?: AbortSignal,
): Promise<{ extract: string; url: string } | null> {
  try {
    // Step 1: Resolve Wikipedia article title via Wikidata sitelinks
    const wdUrl =
      `${WIKIDATA_API_URL}?action=wbgetentities&format=json&props=sitelinks/urls` +
      `&ids=${encodeURIComponent(wikidataId)}&sitefilter=enwiki`;

    const wdResponse = await fetch(wdUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal,
    });

    if (!wdResponse.ok) return null;

    const wdData = await wdResponse.json();
    const entity = wdData?.entities?.[wikidataId];
    const enwiki = entity?.sitelinks?.enwiki;
    if (!enwiki?.title) return null;

    // Step 2: Fetch article extract from Wikipedia REST API
    const wpUrl = `${WIKIPEDIA_API_URL}${encodeURIComponent(enwiki.title)}`;

    const wpResponse = await fetch(wpUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal,
    });

    if (!wpResponse.ok) return null;

    const wpData = await wpResponse.json();
    const extract = wpData?.extract?.trim();
    if (!extract) return null;

    const articleUrl =
      wpData?.content_urls?.desktop?.page ??
      `https://en.wikipedia.org/wiki/${encodeURIComponent(enwiki.title)}`;

    return { extract, url: articleUrl };
  } catch {
    return null;
  }
}

/**
 * Fetch an album description from Wikipedia via MusicBrainz + Wikidata.
 *
 * This is the main entry point for album description enrichment. It chains
 * the MusicBrainz → Wikidata → Wikipedia pipeline and returns a plain-text
 * description with a source URL for attribution.
 *
 * @param artist            The artist name (used for MusicBrainz search if no MBID).
 * @param album             The album name (used for MusicBrainz search if no MBID).
 * @param mbid              Optional MusicBrainz ID (release or release-group).
 * @param isReleaseGroupId  If true, `mbid` is already a release-group ID (e.g. from
 *                          an MBID override). If false/omitted, it's treated as a
 *                          release ID and resolved to its parent release-group.
 * @returns An object with `description` and `url`, or `null`.
 */
export async function getAlbumDescription(
  artist: string,
  album: string,
  mbid?: string | null,
  isReleaseGroupId?: boolean,
  signal?: AbortSignal,
): Promise<{ description: string; url: string } | null> {
  try {
    let releaseGroupId: string | null = null;

    if (mbid) {
      if (isReleaseGroupId) {
        // Override MBIDs from searchReleaseGroups are already release-group IDs
        releaseGroupId = mbid;
      } else {
        // Server-provided MBIDs are release IDs — resolve to release-group
        releaseGroupId = await getReleaseGroupIdForRelease(mbid, signal);
      }
    }

    // Fall back to searching by artist + album name
    if (!releaseGroupId) {
      releaseGroupId = await searchReleaseGroupMBID(artist, album, signal);
    }

    if (!releaseGroupId) return null;

    const wikidataId = await getWikidataIdForReleaseGroup(releaseGroupId, signal);
    if (!wikidataId) return null;

    const result = await getWikipediaExtractForAlbum(wikidataId, signal);
    if (!result) return null;

    return { description: result.extract, url: result.url };
  } catch {
    return null;
  }
}
