/**
 * Hook that resolves a cover art URI from the local disk cache
 * (if available) or the remote Subsonic URL, and triggers a
 * background cache download on a miss.
 *
 * Intended for non-Image consumers like `react-native-image-colors`.
 */

import { useEffect, useState } from 'react';

import {
  cacheAllSizes,
  getCachedImageUri,
} from '../services/imageCacheService';
import { getCoverArtUrl } from '../services/subsonicService';

/** Resolve the best available URI synchronously. */
function resolveUri(
  coverArtId: string | undefined,
  size: number,
): string | null {
  if (!coverArtId) return null;
  const cached = getCachedImageUri(coverArtId, size);
  if (cached) return cached;
  return getCoverArtUrl(coverArtId, size);
}

/**
 * Returns a URI (file:// or http(s)://) for the given cover art,
 * preferring the local cache.  Triggers background caching on miss.
 */
export function useCachedCoverArt(
  coverArtId: string | undefined,
  size: number,
): string | null {
  const [uri, setUri] = useState<string | null>(() =>
    resolveUri(coverArtId, size),
  );

  // Re-resolve when deps change.
  useEffect(() => {
    setUri(resolveUri(coverArtId, size));
  }, [coverArtId, size]);

  // On cache miss, download all sizes then update URI.
  useEffect(() => {
    if (!coverArtId) return;
    let cancelled = false;

    const cached = getCachedImageUri(coverArtId, size);
    if (!cached) {
      cacheAllSizes(coverArtId)
        .then(() => {
          if (cancelled) return;
          const newCached = getCachedImageUri(coverArtId, size);
          if (newCached) setUri(newCached);
        })
        .catch(() => {});
    }

    return () => { cancelled = true; };
  }, [coverArtId, size]);

  return uri;
}
