import * as ExpoCrypto from 'expo-crypto';
import SubsonicAPI, { type AlbumID3, type AlbumWithSongsID3, type Child } from 'subsonic-api';

import { authStore } from '../store/authStore';
import type { ServerInfo } from '../store/serverInfoStore';

const reactNativeCrypto: Crypto = {
  getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
    ExpoCrypto.getRandomValues(array as Uint8Array);
    return array;
  },
} as Crypto;

const { CryptoDigestAlgorithm, CryptoEncoding, getRandomBytesAsync, digestStringAsync } =
  ExpoCrypto;

function normalizeServerUrl(url: string): string {
  let base = url.trim();
  if (!base.startsWith('http://') && !base.startsWith('https://')) {
    base = `https://${base}`;
  }
  return base.replace(/\/+$/, '');
}

let cachedApi: SubsonicAPI | null = null;
let cachedKey: string | null = null;

let cachedCoverArtKey: string | null = null;
let cachedCoverArtSalt: string | null = null;
let cachedCoverArtToken: string | null = null;

export type LoginResult = { success: true; version: string } | { success: false; error: string };

export async function login(
  serverUrl: string,
  username: string,
  password: string
): Promise<LoginResult> {
  const url = normalizeServerUrl(serverUrl);
  const api = new SubsonicAPI({
    url,
    auth: { username: username.trim(), password },
    reuseSalt: true,
    crypto: reactNativeCrypto,
  });

  try {
    const response = await api.ping();

    if (response.status !== 'ok') {
      const err = (response as { error?: { code?: number; message?: string } }).error;
      const message =
        err?.message ?? (err?.code === 40 ? 'Wrong username or password' : 'Authentication failed');
      return { success: false, error: message };
    }

    const version =
      response.openSubsonic && 'serverVersion' in response
        ? response.serverVersion
        : response.version;
    return { success: true, version: version ?? response.version };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed';
    return { success: false, error: message };
  }
}

export function getApi(): SubsonicAPI | null {
  const { isLoggedIn, serverUrl, username, password } = authStore.getState();
  if (!isLoggedIn || !serverUrl || !username || !password) {
    return null;
  }
  const key = `${normalizeServerUrl(serverUrl)}|${username}`;
  if (cachedKey === key && cachedApi) {
    return cachedApi;
  }
  cachedApi = new SubsonicAPI({
    url: normalizeServerUrl(serverUrl),
    auth: { username, password },
    reuseSalt: true,
    crypto: reactNativeCrypto,
  });
  cachedKey = key;
  return cachedApi;
}

export function clearApiCache(): void {
  cachedApi = null;
  cachedKey = null;
  cachedCoverArtKey = null;
  cachedCoverArtSalt = null;
  cachedCoverArtToken = null;
}

export type { AlbumID3, AlbumWithSongsID3, Child };

export async function ensureCoverArtAuth(): Promise<void> {
  const { isLoggedIn, serverUrl, username, password } = authStore.getState();
  if (!isLoggedIn || !serverUrl || !username || !password) return;
  const key = `${normalizeServerUrl(serverUrl)}|${username}`;
  if (cachedCoverArtKey === key && cachedCoverArtSalt && cachedCoverArtToken) return;
  const bytes = await getRandomBytesAsync(16);
  const salt = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const token = await digestStringAsync(
    CryptoDigestAlgorithm.MD5,
    password + salt,
    { encoding: CryptoEncoding.HEX }
  );
  cachedCoverArtKey = key;
  cachedCoverArtSalt = salt;
  cachedCoverArtToken = token;
}

export function getCoverArtUrl(coverArtId: string, size?: number): string | null {
  const { isLoggedIn, serverUrl, username } = authStore.getState();
  if (!coverArtId || !isLoggedIn || !serverUrl || !username) return null;
  if (cachedCoverArtKey === null || !cachedCoverArtSalt || !cachedCoverArtToken) return null;
  const base = `${normalizeServerUrl(serverUrl)}/rest/getCoverArt.view`;
  const params = new URLSearchParams({
    id: coverArtId,
    v: '1.16.1',
    c: 'substreamer',
    u: username,
    t: cachedCoverArtToken,
    s: cachedCoverArtSalt,
  });
  if (size != null && size > 0) params.set('size', String(size));
  return `${base}?${params.toString()}`;
}

export async function getRecentlyAddedAlbums(size?: number): Promise<AlbumID3[]> {
  const api = getApi();
  if (!api) return [];
  const response = await api.getAlbumList2({ type: 'newest', size: size ?? 20 });
  return response.albumList2?.album ?? [];
}

export async function getRecentlyPlayedAlbums(size?: number): Promise<AlbumID3[]> {
  const api = getApi();
  if (!api) return [];
  const response = await api.getAlbumList2({ type: 'recent', size: size ?? 20 });
  return response.albumList2?.album ?? [];
}

export async function getFrequentlyPlayedAlbums(size?: number): Promise<AlbumID3[]> {
  const api = getApi();
  if (!api) return [];
  const response = await api.getAlbumList2({ type: 'frequent', size: size ?? 20 });
  return response.albumList2?.album ?? [];
}

export async function getRandomAlbums(size?: number): Promise<AlbumID3[]> {
  const api = getApi();
  if (!api) return [];
  const response = await api.getAlbumList2({ type: 'random', size: size ?? 20 });
  return response.albumList2?.album ?? [];
}

export async function getAlbum(albumId: string): Promise<AlbumWithSongsID3 | null> {
  const api = getApi();
  if (!api) return null;
  try {
    const response = await api.getAlbum({ id: albumId });
    return response.album ?? null;
  } catch {
    return null;
  }
}

export async function fetchServerInfo(): Promise<ServerInfo | null> {
  const api = getApi();
  if (!api) return null;

  try {
    const pingResponse = await api.ping();
    if (pingResponse.status !== 'ok') return null;

    const apiVersion = pingResponse.version ?? null;
    const openSubsonic = Boolean(
      pingResponse.openSubsonic && 'serverVersion' in pingResponse
    );
    const serverType = openSubsonic && 'type' in pingResponse ? pingResponse.type : null;
    const serverVersion =
      openSubsonic && 'serverVersion' in pingResponse
        ? pingResponse.serverVersion
        : null;

    let extensions: ServerInfo['extensions'] = [];
    if (openSubsonic) {
      try {
        const extResponse = await api.getOpenSubsonicExtensions();
        if (extResponse.status === 'ok' && extResponse.openSubsonicExtensions) {
          extensions = extResponse.openSubsonicExtensions.map((e) => ({
            name: e.name,
            versions: e.versions ?? [],
          }));
        }
      } catch {
        // Server may not support getOpenSubsonicExtensions
      }
    }

    return {
      serverType,
      serverVersion,
      apiVersion,
      openSubsonic,
      extensions,
      lastFetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}
