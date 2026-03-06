const mockListDirectoryAsync = jest.fn();
const mockGetDirectorySizeAsync = jest.fn();
const mockDownloadFileAsyncWithProgress = jest.fn();

jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    _name: string;
    constructor(...args: any[]) {
      if (args.length === 1 && typeof args[0] === 'string') {
        this.uri = args[0];
        this._name = args[0];
      } else {
        const parts = args.map((a: any) => (typeof a === 'string' ? a : a.uri ?? ''));
        this._name = parts.join('/');
        this.uri = `file://${this._name}`;
      }
    }
    get exists() { return false; }
    get size() { return 100; }
    write = jest.fn();
    delete = jest.fn();
    move = jest.fn();
  }
  class MockDirectory {
    uri: string;
    _name: string;
    constructor(...args: any[]) {
      const parts = args.map((a: any) => (typeof a === 'string' ? a : a.uri ?? ''));
      this._name = parts.join('/');
      this.uri = `file://${this._name}`;
    }
    get exists() { return true; }
    create = jest.fn();
    delete = jest.fn();
  }
  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: { document: { uri: 'file:///document' } },
  };
});

jest.mock('expo-async-fs', () => ({
  listDirectoryAsync: (...args: any[]) => mockListDirectoryAsync(...args),
  getDirectorySizeAsync: (...args: any[]) => mockGetDirectorySizeAsync(...args),
  downloadFileAsyncWithProgress: (...args: any[]) => mockDownloadFileAsyncWithProgress(...args),
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('../storageService', () => ({
  checkStorageLimit: jest.fn().mockReturnValue(false),
}));

jest.mock('../downloadSpeedTracker', () => ({
  beginDownload: jest.fn(),
  clearDownload: jest.fn(),
}));

jest.mock('../imageCacheService', () => ({
  cacheAllSizes: jest.fn().mockResolvedValue(undefined),
  getCachedImageUri: jest.fn().mockReturnValue(null),
}));

jest.mock('../subsonicService', () => ({
  ensureCoverArtAuth: jest.fn().mockResolvedValue(undefined),
  getDownloadStreamUrl: jest.fn().mockReturnValue('https://example.com/stream'),
}));

jest.mock('../../store/sqliteStorage', () => require('../../store/__mocks__/sqliteStorage'));

import { musicCacheStore } from '../../store/musicCacheStore';
import { checkStorageLimit } from '../storageService';
import {
  STARRED_SONGS_ITEM_ID,
  STARRED_COVER_ART_ID,
  initMusicCache,
  getLocalTrackUri,
  isItemCached,
  getTrackQueueStatus,
  deleteCachedItem,
  cancelDownload,
  clearDownloadQueue,
  clearMusicCache,
  getMusicCacheStats,
  resumeIfSpaceAvailable,
  deleteStarredSongsDownload,
} from '../musicCacheService';

const mockCheckStorageLimit = checkStorageLimit as jest.Mock;

beforeEach(() => {
  mockListDirectoryAsync.mockReset();
  mockGetDirectorySizeAsync.mockReset();
  mockDownloadFileAsyncWithProgress.mockReset();
  mockCheckStorageLimit.mockReturnValue(false);

  musicCacheStore.setState({
    downloadQueue: [],
    cachedItems: {},
    totalBytes: 0,
    totalFiles: 0,
  } as any);

  initMusicCache();
});

describe('constants', () => {
  it('exports STARRED_SONGS_ITEM_ID', () => {
    expect(STARRED_SONGS_ITEM_ID).toBe('__starred__');
  });

  it('exports STARRED_COVER_ART_ID', () => {
    expect(STARRED_COVER_ART_ID).toBe('__starred_cover__');
  });
});

describe('getLocalTrackUri', () => {
  it('returns null for empty trackId', () => {
    expect(getLocalTrackUri('')).toBeNull();
  });

  it('returns null for unknown trackId', () => {
    expect(getLocalTrackUri('unknown-track')).toBeNull();
  });
});

describe('isItemCached', () => {
  it('returns false when item is not cached', () => {
    expect(isItemCached('album-1')).toBe(false);
  });

  it('returns true when item is in cachedItems', () => {
    musicCacheStore.setState({
      cachedItems: {
        'album-1': {
          itemId: 'album-1',
          type: 'album',
          name: 'Test',
          tracks: [],
          totalBytes: 0,
        },
      },
    } as any);
    expect(isItemCached('album-1')).toBe(true);
  });
});

describe('getTrackQueueStatus', () => {
  it('returns null when track is not in queue', () => {
    expect(getTrackQueueStatus('track-1')).toBeNull();
  });

  it('returns queued status when track is in queued item', () => {
    musicCacheStore.setState({
      downloadQueue: [
        {
          queueId: 'q1',
          itemId: 'album-1',
          status: 'queued',
          tracks: [{ id: 'track-1' }],
        },
      ],
    } as any);
    expect(getTrackQueueStatus('track-1')).toBe('queued');
  });

  it('returns downloading status when track is in downloading item', () => {
    musicCacheStore.setState({
      downloadQueue: [
        {
          queueId: 'q1',
          itemId: 'album-1',
          status: 'downloading',
          tracks: [{ id: 'track-1' }],
        },
      ],
    } as any);
    expect(getTrackQueueStatus('track-1')).toBe('downloading');
  });

  it('returns null for completed items', () => {
    musicCacheStore.setState({
      downloadQueue: [
        {
          queueId: 'q1',
          itemId: 'album-1',
          status: 'completed',
          tracks: [{ id: 'track-1' }],
        },
      ],
    } as any);
    expect(getTrackQueueStatus('track-1')).toBeNull();
  });
});

describe('deleteCachedItem', () => {
  it('does nothing for empty itemId', () => {
    deleteCachedItem('');
    // No errors
  });

  it('removes cached item from store', () => {
    musicCacheStore.setState({
      cachedItems: {
        'album-1': {
          itemId: 'album-1',
          type: 'album',
          name: 'Test',
          tracks: [{ id: 't1', fileName: 't1.mp3' }],
          totalBytes: 1000,
        },
      },
    } as any);

    deleteCachedItem('album-1');

    expect(musicCacheStore.getState().cachedItems['album-1']).toBeUndefined();
  });
});

describe('cancelDownload', () => {
  it('does nothing when queueId not found', () => {
    cancelDownload('nonexistent');
    // No error
  });

  it('removes item from queue', () => {
    musicCacheStore.setState({
      downloadQueue: [
        {
          queueId: 'q1',
          itemId: 'album-1',
          status: 'queued',
          tracks: [{ id: 't1' }],
        },
      ],
    } as any);

    cancelDownload('q1');

    expect(musicCacheStore.getState().downloadQueue.find(
      (q: any) => q.queueId === 'q1',
    )).toBeUndefined();
  });
});

describe('clearDownloadQueue', () => {
  it('removes all queued items', () => {
    musicCacheStore.setState({
      downloadQueue: [
        { queueId: 'q1', itemId: 'a1', status: 'queued', tracks: [{ id: 't1' }] },
        { queueId: 'q2', itemId: 'a2', status: 'downloading', tracks: [{ id: 't2' }] },
      ],
    } as any);

    clearDownloadQueue();

    expect(musicCacheStore.getState().downloadQueue).toHaveLength(0);
  });
});

describe('clearMusicCache', () => {
  it('clears all cache and returns freed bytes', async () => {
    mockGetDirectorySizeAsync.mockResolvedValue(50000);

    const freed = await clearMusicCache();

    expect(freed).toBe(50000);
  });
});

describe('getMusicCacheStats', () => {
  it('returns total bytes, item count, and file count', async () => {
    mockGetDirectorySizeAsync.mockResolvedValue(100000);
    mockListDirectoryAsync
      .mockResolvedValueOnce(['album-1', 'album-2'])
      .mockResolvedValueOnce(['t1.mp3', 't2.mp3'])
      .mockResolvedValueOnce(['t3.flac']);

    const stats = await getMusicCacheStats();

    expect(stats.totalBytes).toBe(100000);
    expect(stats.itemCount).toBe(2);
    expect(stats.totalFiles).toBe(3);
  });

  it('returns zeros on listing error', async () => {
    mockGetDirectorySizeAsync.mockResolvedValue(0);
    mockListDirectoryAsync.mockRejectedValue(new Error('ENOENT'));

    const stats = await getMusicCacheStats();

    expect(stats.totalBytes).toBe(0);
    expect(stats.itemCount).toBe(0);
    expect(stats.totalFiles).toBe(0);
  });
});

describe('resumeIfSpaceAvailable', () => {
  it('does not resume when storage is full', () => {
    mockCheckStorageLimit.mockReturnValue(true);
    resumeIfSpaceAvailable();
    // No crash; queue processing should not start
  });

  it('attempts to process queue when space available', () => {
    mockCheckStorageLimit.mockReturnValue(false);
    resumeIfSpaceAvailable();
    // No crash; processQueue will run (no items to process)
  });
});

describe('deleteStarredSongsDownload', () => {
  it('delegates to deleteCachedItem with starred ID', () => {
    musicCacheStore.setState({
      cachedItems: {
        [STARRED_SONGS_ITEM_ID]: {
          itemId: STARRED_SONGS_ITEM_ID,
          type: 'playlist',
          name: 'Favorite Songs',
          tracks: [],
          totalBytes: 0,
        },
      },
    } as any);

    deleteStarredSongsDownload();

    expect(musicCacheStore.getState().cachedItems[STARRED_SONGS_ITEM_ID]).toBeUndefined();
  });
});
