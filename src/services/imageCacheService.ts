/**
 * Persistent on-disk image cache service.
 *
 * Stores cover art images in {Paths.document}/image-cache/ so they
 * survive app updates and are not purged by the OS.
 *
 * Each cover art ID gets its own subdirectory containing up to 4 size
 * variants (50, 150, 300, 600):
 *
 *   image-cache/{coverArtId}/50.jpg
 *   image-cache/{coverArtId}/150.jpg
 *   image-cache/{coverArtId}/300.jpg
 *   image-cache/{coverArtId}/600.jpg
 */

import { Directory, File, Paths } from 'expo-file-system';
import { readDirectoryAsync } from 'expo-file-system/legacy';
import { fetch } from 'expo/fetch';

import { imageCacheStore } from '../store/imageCacheStore';
import { ensureCoverArtAuth, getCoverArtUrl } from './subsonicService';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** All image size tiers used across the app. */
export const IMAGE_SIZES = [50, 150, 300, 600] as const;

/** Supported extensions ordered by likelihood. */
const EXTENSIONS = ['.jpg', '.png', '.webp'] as const;

/** Map Content-Type to file extension. */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/* ------------------------------------------------------------------ */
/*  Module state                                                       */
/* ------------------------------------------------------------------ */

let cacheDir: Directory | null = null;

/** In-flight download guard: prevents duplicate parallel downloads. */
const downloading = new Set<string>();

/**
 * In-memory URI cache: avoids repeated synchronous filesystem lookups
 * for the same coverArtId + size combination. Keyed by "coverArtId:size".
 */
const uriCache = new Map<string, string | null>();

function uriCacheKey(coverArtId: string, size: number): string {
  return `${coverArtId}:${size}`;
}

/* ------------------------------------------------------------------ */
/*  Initialisation                                                     */
/* ------------------------------------------------------------------ */

/**
 * Create the image-cache directory under Paths.document.
 * Safe to call multiple times (no-ops if already exists).
 */
export function initImageCache(): void {
  if (cacheDir) return;
  const dir = new Directory(Paths.document, 'image-cache');
  if (!dir.exists) {
    dir.create();
  }
  cacheDir = dir;
}

/** Return the initialised cache directory (auto-inits if needed). */
function ensureCacheDir(): Directory {
  if (!cacheDir) initImageCache();
  return cacheDir!;
}

/* ------------------------------------------------------------------ */
/*  Cache lookup (synchronous)                                         */
/* ------------------------------------------------------------------ */

/**
 * Check if a cached image exists for the given coverArtId and size.
 * Returns the local `file://` URI or `null`.
 */
export function getCachedImageUri(
  coverArtId: string,
  size: number,
): string | null {
  if (!coverArtId) return null;

  const key = uriCacheKey(coverArtId, size);
  if (uriCache.has(key)) return uriCache.get(key)!;

  const subDir = new Directory(ensureCacheDir(), coverArtId);
  if (!subDir.exists) {
    uriCache.set(key, null);
    return null;
  }
  for (const ext of EXTENSIONS) {
    const file = new File(subDir, `${size}${ext}`);
    if (file.exists) {
      uriCache.set(key, file.uri);
      return file.uri;
    }
  }
  uriCache.set(key, null);
  return null;
}

/**
 * Evict a single in-memory cache entry so the next lookup hits the
 * filesystem. Used by CachedImage's onError recovery path.
 */
export function evictUriCacheEntry(coverArtId: string, size: number): void {
  uriCache.delete(uriCacheKey(coverArtId, size));
}

/* ------------------------------------------------------------------ */
/*  Download helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Download a single image variant and write it to the cache.
 * Returns silently on failure so one bad size doesn't block others.
 */
async function downloadOne(
  coverArtId: string,
  size: number,
): Promise<void> {
  await ensureCoverArtAuth();
  const url = getCoverArtUrl(coverArtId, size);
  if (!url) return;

  try {
    const response = await fetch(url);
    if (!response.ok) return;

    const contentType = response.headers.get('content-type') ?? '';
    const ext = MIME_TO_EXT[contentType.split(';')[0].trim()] ?? '.jpg';

    const subDir = new Directory(ensureCacheDir(), coverArtId);
    if (!subDir.exists) subDir.create();
    const file = new File(subDir, `${size}${ext}`);

    const bytes = new Uint8Array(await response.arrayBuffer());
    file.write(bytes);
    imageCacheStore.getState().addFile(bytes.length);
  } catch {
    // Swallow – caching is best-effort.
  }
}

/**
 * Download all size variants for a coverArtId in parallel.
 * No-ops if a download for this ID is already in progress.
 */
export async function cacheAllSizes(coverArtId: string): Promise<void> {
  if (!coverArtId) return;
  if (downloading.has(coverArtId)) return;
  downloading.add(coverArtId);
  try {
    await Promise.all(IMAGE_SIZES.map((s) => downloadOne(coverArtId, s)));
  } finally {
    downloading.delete(coverArtId);
    // Re-populate the in-memory cache so subsequent lookups skip FS I/O.
    for (const s of IMAGE_SIZES) {
      const key = uriCacheKey(coverArtId, s);
      uriCache.delete(key);
      getCachedImageUri(coverArtId, s);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Cache stats                                                        */
/* ------------------------------------------------------------------ */

export interface ImageCacheStats {
  /** Total bytes used by the image cache. */
  totalBytes: number;
  /** Number of unique cover art images cached (each has 4 size variants). */
  imageCount: number;
}

/**
 * Calculate cache statistics.
 */
export function getImageCacheStats(): ImageCacheStats {
  const dir = ensureCacheDir();
  const totalBytes = dir.size ?? 0;

  // Each subdirectory represents one unique cover art image.
  let imageCount = 0;
  try {
    const contents = dir.list();
    imageCount = contents.filter((item) => item instanceof Directory).length;
  } catch {
    imageCount = 0;
  }

  return { totalBytes, imageCount };
}

/* ------------------------------------------------------------------ */
/*  Cache browsing                                                     */
/* ------------------------------------------------------------------ */

/** A single cached file variant. */
interface CachedFileEntry {
  size: number;
  fileName: string;
  uri: string;
}

/** A cached image with all its size variants. */
export interface CachedImageEntry {
  coverArtId: string;
  files: CachedFileEntry[];
}

/** Regex to parse size-variant filenames: {size}.{ext} */
const SIZE_FILE_RE = /^(50|150|300|600)\.(jpg|png|webp)$/;

/**
 * List all cached images grouped by coverArtId.
 * Each entry includes the individual file variants found on disk.
 */
function listCachedImages(): CachedImageEntry[] {
  const dir = ensureCacheDir();
  let subDirs: (File | Directory)[];
  try {
    subDirs = dir.list();
  } catch {
    return [];
  }

  const entries: CachedImageEntry[] = [];

  for (const subDir of subDirs) {
    if (!(subDir instanceof Directory)) continue;
    const coverArtId = subDir.uri.split('/').filter(Boolean).pop() ?? '';
    if (!coverArtId) continue;

    const files: CachedFileEntry[] = [];
    try {
      for (const item of subDir.list()) {
        if (!(item instanceof File)) continue;
        const name = item.uri.split('/').pop() ?? '';
        const match = SIZE_FILE_RE.exec(name);
        if (!match) continue;
        files.push({ size: Number(match[1]), fileName: name, uri: item.uri });
      }
    } catch {
      continue;
    }

    if (files.length > 0) {
      files.sort((a, b) => a.size - b.size);
      entries.push({ coverArtId, files });
    }
  }

  entries.sort((a, b) => a.coverArtId.localeCompare(b.coverArtId));
  return entries;
}

/**
 * Async version of {@link listCachedImages} that uses the legacy
 * `readDirectoryAsync` API so the directory listing runs on a native
 * background thread instead of blocking the JS thread.
 */
export async function listCachedImagesAsync(): Promise<CachedImageEntry[]> {
  const dir = ensureCacheDir();
  const dirUri = dir.uri.endsWith('/') ? dir.uri : `${dir.uri}/`;

  let subDirNames: string[];
  try {
    subDirNames = await readDirectoryAsync(dir.uri);
  } catch {
    return [];
  }

  const entries: CachedImageEntry[] = [];

  for (const coverArtId of subDirNames) {
    const subDirUri = `${dirUri}${coverArtId}`;
    let fileNames: string[];
    try {
      fileNames = await readDirectoryAsync(subDirUri);
    } catch {
      continue;
    }

    const subUri = subDirUri.endsWith('/') ? subDirUri : `${subDirUri}/`;
    const files: CachedFileEntry[] = [];

    for (const name of fileNames) {
      const match = SIZE_FILE_RE.exec(name);
      if (!match) continue;
      files.push({ size: Number(match[1]), fileName: name, uri: `${subUri}${name}` });
    }

    if (files.length > 0) {
      files.sort((a, b) => a.size - b.size);
      entries.push({ coverArtId, files });
    }
  }

  entries.sort((a, b) => a.coverArtId.localeCompare(b.coverArtId));
  return entries;
}

/**
 * Delete all cached variants for a single coverArtId.
 * Updates the imageCacheStore stats accordingly.
 */
export function deleteCachedImage(coverArtId: string): void {
  if (!coverArtId) return;

  // Evict all size variants from the in-memory cache.
  for (const s of IMAGE_SIZES) {
    uriCache.delete(uriCacheKey(coverArtId, s));
  }

  const subDir = new Directory(ensureCacheDir(), coverArtId);
  if (!subDir.exists) return;

  // Tally files before deleting the directory.
  let deletedCount = 0;
  let deletedBytes = 0;
  try {
    for (const item of subDir.list()) {
      if (item instanceof File) {
        deletedBytes += item.size ?? 0;
        deletedCount++;
      }
    }
  } catch {
    // Best-effort – proceed with deletion regardless.
  }

  try {
    subDir.delete();
  } catch {
    // May fail if already removed; ignore.
  }

  if (deletedCount > 0) {
    imageCacheStore.getState().removeFiles(deletedCount, deletedBytes);
  }
}

/**
 * Re-download all size variants for a single coverArtId.
 * Deletes existing files first, then downloads fresh copies.
 */
export async function refreshCachedImage(coverArtId: string): Promise<void> {
  deleteCachedImage(coverArtId);
  // Clear the in-flight guard so cacheAllSizes will proceed.
  downloading.delete(coverArtId);
  await cacheAllSizes(coverArtId);
}

/* ------------------------------------------------------------------ */
/*  Cache clearing                                                     */
/* ------------------------------------------------------------------ */

/**
 * Delete all cached images and recreate the cache directory.
 * Returns the number of bytes freed.
 */
export function clearImageCache(): number {
  const dir = ensureCacheDir();
  const freedBytes = dir.size ?? 0;
  try {
    dir.delete();
  } catch {
    // May fail if already empty; ignore.
  }
  // Recreate.
  cacheDir = null;
  uriCache.clear();
  initImageCache();
  imageCacheStore.getState().reset();
  return freedBytes;
}
