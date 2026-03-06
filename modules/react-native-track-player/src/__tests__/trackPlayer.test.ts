import { Platform, AppRegistry } from 'react-native';

import NativeTrackPlayer from '../NativeTrackPlayer';
import { RepeatMode } from '../constants';
import * as TrackPlayer from '../trackPlayer';

jest.mock('../NativeTrackPlayer');
jest.mock('../resolveAssetSource');

const mockNative = jest.mocked(NativeTrackPlayer);

beforeEach(() => {
  jest.clearAllMocks();
});

// -- Lifecycle --

describe('setupPlayer', () => {
  it('delegates to native with options', async () => {
    await TrackPlayer.setupPlayer({ minBuffer: 30 });

    expect(mockNative.setupPlayer).toHaveBeenCalledWith({ minBuffer: 30 });
  });

  it('passes empty object when no options given', async () => {
    await TrackPlayer.setupPlayer();

    expect(mockNative.setupPlayer).toHaveBeenCalledWith({});
  });
});

describe('registerPlaybackService', () => {
  const handler = jest.fn();
  const factory = jest.fn().mockReturnValue(handler);

  beforeEach(() => {
    factory.mockClear();
    handler.mockClear();
  });

  it('registers headless task on Android', () => {
    if (Platform.OS !== 'android') return;
    const spy = jest.spyOn(AppRegistry, 'registerHeadlessTask');

    TrackPlayer.registerPlaybackService(factory);

    expect(spy).toHaveBeenCalledWith('TrackPlayer', factory);
    spy.mockRestore();
  });

  it('calls factory immediately on iOS', async () => {
    if (Platform.OS !== 'ios') return;

    TrackPlayer.registerPlaybackService(factory);

    // setImmediate is used internally; flush the microtask queue
    await new Promise((resolve) => setImmediate(resolve));

    expect(factory).toHaveBeenCalled();
    expect(handler).toHaveBeenCalled();
  });
});

// -- Queue API --

describe('add', () => {
  const track = { url: 'https://example.com/song.mp3', title: 'Test' };

  it('wraps a single track in an array', async () => {
    await TrackPlayer.add(track);

    expect(mockNative.add).toHaveBeenCalledWith(
      [expect.objectContaining({ url: 'https://example.com/song.mp3', title: 'Test' })],
      -1,
    );
  });

  it('passes an array of tracks directly', async () => {
    const tracks = [track, { url: 'https://example.com/song2.mp3', title: 'Test 2' }];
    await TrackPlayer.add(tracks);

    expect(mockNative.add).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Test' }),
        expect.objectContaining({ title: 'Test 2' }),
      ]),
      -1,
    );
  });

  it('returns undefined for empty array without calling native', async () => {
    const result = await TrackPlayer.add([]);

    expect(result).toBeUndefined();
    expect(mockNative.add).not.toHaveBeenCalled();
  });

  it('passes insertBeforeIndex when provided', async () => {
    await TrackPlayer.add(track, 3);

    expect(mockNative.add).toHaveBeenCalledWith(expect.any(Array), 3);
  });

  it('resolves numeric asset URLs via resolveAssetSource', async () => {
    const assetTrack = { url: 42 as unknown as string, title: 'Local' };
    await TrackPlayer.add(assetTrack);

    expect(mockNative.add).toHaveBeenCalledWith(
      [expect.objectContaining({ url: { uri: 'asset://42' } })],
      -1,
    );
  });

  it('resolves numeric artwork via resolveAssetSource', async () => {
    const artworkTrack = { url: 'https://x.com/s.mp3', artwork: 99 as unknown as string };
    await TrackPlayer.add(artworkTrack);

    expect(mockNative.add).toHaveBeenCalledWith(
      [expect.objectContaining({ artwork: { uri: 'asset://99' } })],
      -1,
    );
  });
});

describe('load', () => {
  it('delegates to native with resolved track', async () => {
    const track = { url: 'https://example.com/song.mp3', title: 'Song' };
    await TrackPlayer.load(track);

    expect(mockNative.load).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com/song.mp3' }),
    );
  });
});

describe('move', () => {
  it('passes fromIndex and toIndex to native', async () => {
    await TrackPlayer.move(0, 5);

    expect(mockNative.move).toHaveBeenCalledWith(0, 5);
  });
});

describe('remove', () => {
  it('wraps a single index in an array', async () => {
    await TrackPlayer.remove(3);

    expect(mockNative.remove).toHaveBeenCalledWith([3]);
  });

  it('passes multiple indexes as array', async () => {
    await TrackPlayer.remove([1, 3, 5]);

    expect(mockNative.remove).toHaveBeenCalledWith([1, 3, 5]);
  });
});

describe('removeUpcomingTracks', () => {
  it('delegates to native', async () => {
    await TrackPlayer.removeUpcomingTracks();

    expect(mockNative.removeUpcomingTracks).toHaveBeenCalled();
  });
});

describe('skip', () => {
  it('passes index with default initialPosition', async () => {
    await TrackPlayer.skip(2);

    expect(mockNative.skip).toHaveBeenCalledWith(2, -1);
  });

  it('passes explicit initialPosition', async () => {
    await TrackPlayer.skip(2, 30);

    expect(mockNative.skip).toHaveBeenCalledWith(2, 30);
  });
});

describe('skipToNext', () => {
  it('passes default initialPosition', async () => {
    await TrackPlayer.skipToNext();

    expect(mockNative.skipToNext).toHaveBeenCalledWith(-1);
  });

  it('passes explicit initialPosition', async () => {
    await TrackPlayer.skipToNext(15);

    expect(mockNative.skipToNext).toHaveBeenCalledWith(15);
  });
});

describe('skipToPrevious', () => {
  it('passes default initialPosition', async () => {
    await TrackPlayer.skipToPrevious();

    expect(mockNative.skipToPrevious).toHaveBeenCalledWith(-1);
  });

  it('passes explicit initialPosition', async () => {
    await TrackPlayer.skipToPrevious(10);

    expect(mockNative.skipToPrevious).toHaveBeenCalledWith(10);
  });
});

// -- Player API --

describe('play', () => {
  it('delegates to native', async () => {
    await TrackPlayer.play();
    expect(mockNative.play).toHaveBeenCalled();
  });
});

describe('pause', () => {
  it('delegates to native', async () => {
    await TrackPlayer.pause();
    expect(mockNative.pause).toHaveBeenCalled();
  });
});

describe('stop', () => {
  it('delegates to native', async () => {
    await TrackPlayer.stop();
    expect(mockNative.stop).toHaveBeenCalled();
  });
});

describe('reset', () => {
  it('delegates to native', async () => {
    await TrackPlayer.reset();
    expect(mockNative.reset).toHaveBeenCalled();
  });
});

describe('seekTo', () => {
  it('passes position to native', async () => {
    await TrackPlayer.seekTo(120);
    expect(mockNative.seekTo).toHaveBeenCalledWith(120);
  });
});

describe('seekBy', () => {
  it('passes offset to native', async () => {
    await TrackPlayer.seekBy(-10);
    expect(mockNative.seekBy).toHaveBeenCalledWith(-10);
  });
});

describe('setVolume', () => {
  it('passes level to native', async () => {
    await TrackPlayer.setVolume(0.5);
    expect(mockNative.setVolume).toHaveBeenCalledWith(0.5);
  });
});

describe('setRate', () => {
  it('passes rate to native', async () => {
    await TrackPlayer.setRate(1.5);
    expect(mockNative.setRate).toHaveBeenCalledWith(1.5);
  });
});

describe('setPlayWhenReady', () => {
  it('passes boolean to native', async () => {
    await TrackPlayer.setPlayWhenReady(true);
    expect(mockNative.setPlayWhenReady).toHaveBeenCalledWith(true);
  });
});

describe('setRepeatMode', () => {
  it('passes mode to native', async () => {
    await TrackPlayer.setRepeatMode(RepeatMode.Queue);
    expect(mockNative.setRepeatMode).toHaveBeenCalledWith(RepeatMode.Queue);
  });
});

describe('setQueue', () => {
  it('passes tracks to native', async () => {
    const tracks = [{ url: 'https://x.com/a.mp3', title: 'A' }];
    await TrackPlayer.setQueue(tracks as any);
    expect(mockNative.setQueue).toHaveBeenCalledWith(tracks);
  });
});

describe('updateOptions', () => {
  it('delegates to native with android options merged', async () => {
    await TrackPlayer.updateOptions({ progressUpdateEventInterval: 2 });

    expect(mockNative.updateOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        progressUpdateEventInterval: 2,
        android: {},
      }),
    );
  });
});

describe('updateMetadataForTrack', () => {
  it('passes trackIndex and metadata to native', async () => {
    const metadata = { title: 'Updated', artwork: 'https://x.com/art.jpg' };
    await TrackPlayer.updateMetadataForTrack(0, metadata);

    expect(mockNative.updateMetadataForTrack).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ title: 'Updated', artwork: 'https://x.com/art.jpg' }),
    );
  });
});

describe('updateNowPlayingMetadata', () => {
  it('delegates to native with resolved artwork', async () => {
    const metadata = { title: 'Now', artist: 'Artist', artwork: 'https://x.com/art.jpg' };
    await TrackPlayer.updateNowPlayingMetadata(metadata);

    expect(mockNative.updateNowPlayingMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Now', artwork: 'https://x.com/art.jpg' }),
    );
  });
});

// -- Getters --

describe('getVolume', () => {
  it('returns volume from native', async () => {
    mockNative.getVolume.mockResolvedValue(0.8);
    const result = await TrackPlayer.getVolume();
    expect(result).toBe(0.8);
  });
});

describe('getRate', () => {
  it('returns rate from native', async () => {
    mockNative.getRate.mockResolvedValue(1.5);
    const result = await TrackPlayer.getRate();
    expect(result).toBe(1.5);
  });
});

describe('getPlayWhenReady', () => {
  it('returns boolean from native', async () => {
    mockNative.getPlayWhenReady.mockResolvedValue(true);
    const result = await TrackPlayer.getPlayWhenReady();
    expect(result).toBe(true);
  });
});

describe('getActiveTrackIndex', () => {
  it('returns number when track exists', async () => {
    mockNative.getActiveTrackIndex.mockResolvedValue(2);
    const result = await TrackPlayer.getActiveTrackIndex();
    expect(result).toBe(2);
  });

  it('converts null to undefined', async () => {
    mockNative.getActiveTrackIndex.mockResolvedValue(null as any);
    const result = await TrackPlayer.getActiveTrackIndex();
    expect(result).toBeUndefined();
  });
});

describe('getActiveTrack', () => {
  it('returns Track when exists', async () => {
    const track = { url: 'https://x.com/s.mp3', title: 'S' };
    mockNative.getActiveTrack.mockResolvedValue(track);
    const result = await TrackPlayer.getActiveTrack();
    expect(result).toEqual(track);
  });

  it('converts null to undefined', async () => {
    mockNative.getActiveTrack.mockResolvedValue(null as any);
    const result = await TrackPlayer.getActiveTrack();
    expect(result).toBeUndefined();
  });
});

describe('getProgress', () => {
  it('returns Progress object', async () => {
    const progress = { position: 30, duration: 180, buffered: 60 };
    mockNative.getProgress.mockResolvedValue(progress);
    const result = await TrackPlayer.getProgress();
    expect(result).toEqual(progress);
  });
});

describe('getPlaybackState', () => {
  it('returns PlaybackState object', async () => {
    const state = { state: 'playing' };
    mockNative.getPlaybackState.mockResolvedValue(state);
    const result = await TrackPlayer.getPlaybackState();
    expect(result).toEqual(state);
  });
});

describe('getRepeatMode', () => {
  it('returns repeat mode from native', async () => {
    mockNative.getRepeatMode.mockResolvedValue(2);
    const result = await TrackPlayer.getRepeatMode();
    expect(result).toBe(2);
  });
});

describe('getQueue', () => {
  it('returns array of tracks', async () => {
    const queue = [{ url: 'a.mp3', title: 'A' }];
    mockNative.getQueue.mockResolvedValue(queue);
    const result = await TrackPlayer.getQueue();
    expect(result).toEqual(queue);
  });
});

describe('getTrack', () => {
  it('returns track at index', async () => {
    const track = { url: 'a.mp3', title: 'A' };
    mockNative.getTrack.mockResolvedValue(track);
    const result = await TrackPlayer.getTrack(0);
    expect(result).toEqual(track);
    expect(mockNative.getTrack).toHaveBeenCalledWith(0);
  });
});

describe('retry', () => {
  it('delegates to native', async () => {
    await TrackPlayer.retry();
    expect(mockNative.retry).toHaveBeenCalled();
  });
});

// -- Platform-specific --

describe('acquireWakeLock', () => {
  it('calls native on Android, is no-op on iOS', async () => {
    await TrackPlayer.acquireWakeLock();

    if (Platform.OS === 'android') {
      expect(mockNative.acquireWakeLock).toHaveBeenCalled();
    } else {
      expect(mockNative.acquireWakeLock).not.toHaveBeenCalled();
    }
  });
});

describe('abandonWakeLock', () => {
  it('calls native on Android, is no-op on iOS', async () => {
    await TrackPlayer.abandonWakeLock();

    if (Platform.OS === 'android') {
      expect(mockNative.abandonWakeLock).toHaveBeenCalled();
    } else {
      expect(mockNative.abandonWakeLock).not.toHaveBeenCalled();
    }
  });
});

describe('validateOnStartCommandIntent', () => {
  it('returns true on iOS without calling native', async () => {
    if (Platform.OS !== 'ios') return;
    const result = await TrackPlayer.validateOnStartCommandIntent();
    expect(result).toBe(true);
    expect(mockNative.validateOnStartCommandIntent).not.toHaveBeenCalled();
  });

  it('calls native on Android', async () => {
    if (Platform.OS !== 'android') return;
    mockNative.validateOnStartCommandIntent.mockResolvedValue(false);
    const result = await TrackPlayer.validateOnStartCommandIntent();
    expect(result).toBe(false);
    expect(mockNative.validateOnStartCommandIntent).toHaveBeenCalled();
  });
});

// -- Events --

describe('addEventListener', () => {
  it('subscribes to native event emitter', () => {
    const { Event } = require('../constants');
    const listener = jest.fn();

    TrackPlayer.addEventListener(Event.PlaybackState, listener);

    // The emitter.addListener is called internally; we verify no throw
    expect(listener).not.toHaveBeenCalled();
  });
});
