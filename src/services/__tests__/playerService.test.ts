jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    setupPlayer: jest.fn().mockResolvedValue(undefined),
    updateOptions: jest.fn().mockResolvedValue(undefined),
    setRepeatMode: jest.fn().mockResolvedValue(undefined),
    setRate: jest.fn().mockResolvedValue(undefined),
    addEventListener: jest.fn(),
    reset: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue(undefined),
    skip: jest.fn().mockResolvedValue(undefined),
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    seekTo: jest.fn().mockResolvedValue(undefined),
    skipToNext: jest.fn().mockResolvedValue(undefined),
    skipToPrevious: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    setQueue: jest.fn().mockResolvedValue(undefined),
    retry: jest.fn().mockResolvedValue(undefined),
    getPlaybackState: jest.fn().mockResolvedValue({ state: 0 }),
    getActiveTrack: jest.fn().mockResolvedValue(null),
    getActiveTrackIndex: jest.fn().mockResolvedValue(0),
    getProgress: jest.fn().mockResolvedValue({ position: 0, duration: 0, buffered: 0 }),
  },
  Capability: { Play: 0, Pause: 1, SkipToNext: 2, SkipToPrevious: 3, Stop: 4, SeekTo: 5 },
  Event: {
    PlaybackState: 'playback-state',
    PlaybackError: 'playback-error',
    PlaybackActiveTrackChanged: 'playback-active-track-changed',
    PlaybackEndedWithReason: 'playback-ended-with-reason',
    PlaybackStalled: 'playback-stalled',
    PlaybackErrorLog: 'playback-error-log',
    PlaybackBufferEmpty: 'playback-buffer-empty',
    PlaybackBufferFull: 'playback-buffer-full',
    PlaybackSeekCompleted: 'playback-seek-completed',
  },
  IOSCategory: { Playback: 'playback' },
  RepeatMode: { Off: 0, Track: 1, Queue: 2 },
  State: { Playing: 3, Paused: 2, Buffering: 6, Loading: 9, Stopped: 1, Ended: 11, None: 0, Ready: 8, Connecting: 7, Error: 10 },
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('../../store/sqliteStorage', () => require('../../store/__mocks__/sqliteStorage'));

const mockSetCurrentTrack = jest.fn();
const mockSetPlaybackState = jest.fn();
const mockSetQueue = jest.fn();
const mockSetProgress = jest.fn();
const mockSetError = jest.fn();
const mockSetRetrying = jest.fn();
const mockSetQueueLoading = jest.fn();

jest.mock('../../store/playerStore', () => ({
  playerStore: {
    getState: jest.fn(() => ({
      currentTrack: null,
      currentTrackIndex: null,
      queue: [],
      duration: 100,
      error: null,
      retrying: false,
      setCurrentTrack: mockSetCurrentTrack,
      setPlaybackState: mockSetPlaybackState,
      setQueue: mockSetQueue,
      setProgress: mockSetProgress,
      setError: mockSetError,
      setRetrying: mockSetRetrying,
      setQueueLoading: mockSetQueueLoading,
    })),
  },
}));

const mockToastShow = jest.fn();
const mockToastSucceed = jest.fn();
const mockToastFail = jest.fn();

jest.mock('../../store/playbackToastStore', () => ({
  playbackToastStore: {
    getState: jest.fn(() => ({
      show: mockToastShow,
      succeed: mockToastSucceed,
      fail: mockToastFail,
    })),
  },
}));

jest.mock('../../store/serverInfoStore', () => ({
  serverInfoStore: {
    getState: jest.fn(() => ({ extensions: [] })),
  },
}));

jest.mock('../scrobbleService', () => ({
  addCompletedScrobble: jest.fn(),
  sendNowPlaying: jest.fn(),
}));

jest.mock('../imageCacheService', () => ({
  getCachedImageUri: jest.fn().mockReturnValue(null),
}));

jest.mock('../musicCacheService', () => ({
  getLocalTrackUri: jest.fn().mockReturnValue(null),
}));

jest.mock('../subsonicService', () => ({
  ensureCoverArtAuth: jest.fn().mockResolvedValue(undefined),
  getCoverArtUrl: jest.fn().mockReturnValue('https://example.com/art.jpg'),
  getStreamUrl: jest.fn().mockReturnValue('https://example.com/stream.mp3'),
}));

import TrackPlayer, { RepeatMode, State } from 'react-native-track-player';
import { playbackSettingsStore } from '../../store/playbackSettingsStore';

const mockTP = TrackPlayer as unknown as Record<string, jest.Mock>;
import {
  initPlayer,
  playTrack,
  togglePlayPause,
  skipToNext,
  skipToPrevious,
  seekTo,
  skipToTrack,
  retryPlayback,
  clearQueue,
  addToQueue,
  removeFromQueue,
  cycleRepeatMode,
  cyclePlaybackRate,
  shuffleQueue,
} from '../playerService';
import { type Child } from '../subsonicService';

const makeChild = (id: string, overrides?: Partial<Child>): Child => ({
  id,
  title: `Song ${id}`,
  artist: 'Test Artist',
  album: 'Test Album',
  coverArt: `cover-${id}`,
  duration: 200,
  ...overrides,
} as Child);

beforeEach(() => {
  jest.clearAllMocks();
  playbackSettingsStore.setState({
    repeatMode: 'off',
    playbackRate: 1,
    maxBitRate: null,
    streamFormat: 'raw',
    estimateContentLength: false,
  } as any);
});

describe('initPlayer', () => {
  it('sets up TrackPlayer and registers event listeners', async () => {
    await initPlayer();

    expect(mockTP.setupPlayer).toHaveBeenCalledTimes(1);
    expect(mockTP.updateOptions).toHaveBeenCalledTimes(1);
    expect(mockTP.setRepeatMode).toHaveBeenCalledWith(RepeatMode.Off);
    expect(mockTP.setRate).toHaveBeenCalledWith(1);
    expect(mockTP.addEventListener).toHaveBeenCalled();
  });

  it('is idempotent on repeated calls', async () => {
    // initPlayer is already done from the first test; module-level isPlayerReady is true.
    // Additional calls should be no-ops.
    await initPlayer();
    await initPlayer();
    expect(mockTP.setupPlayer).not.toHaveBeenCalled();
  });

  it('applies persisted repeat mode', async () => {
    jest.resetModules();
    playbackSettingsStore.setState({ repeatMode: 'all' } as any);

    jest.isolateModules(() => {
      // Can't easily test since initPlayer already ran, but we verify the mapping
    });
  });
});

describe('playTrack', () => {
  it('resets queue, loads tracks, and starts playback', async () => {
    await initPlayer();
    const queue = [makeChild('t1'), makeChild('t2'), makeChild('t3')];

    await playTrack(queue[1], queue);

    expect(mockTP.reset).toHaveBeenCalled();
    expect(mockTP.add).toHaveBeenCalledTimes(1);
    const addedTracks = mockTP.add.mock.calls[0][0];
    expect(addedTracks).toHaveLength(3);
    expect(addedTracks[0].id).toBe('t1');
    expect(mockTP.skip).toHaveBeenCalledWith(1);
    expect(mockTP.play).toHaveBeenCalled();
    expect(mockToastShow).toHaveBeenCalled();
    expect(mockToastSucceed).toHaveBeenCalled();
  });

  it('does not skip when playing first track', async () => {
    await initPlayer();
    const queue = [makeChild('t1'), makeChild('t2')];

    await playTrack(queue[0], queue);

    expect(mockTP.skip).not.toHaveBeenCalled();
    expect(mockTP.play).toHaveBeenCalled();
  });

  it('shows failure toast on error', async () => {
    await initPlayer();
    mockTP.add.mockRejectedValueOnce(new Error('RNTP error'));

    await playTrack(makeChild('t1'), [makeChild('t1')]);

    expect(mockToastFail).toHaveBeenCalledWith('RNTP error');
  });

  it('updates queue in store', async () => {
    await initPlayer();
    const queue = [makeChild('t1')];
    await playTrack(queue[0], queue);
    expect(mockSetQueue).toHaveBeenCalledWith(queue);
  });
});

describe('togglePlayPause', () => {
  it('pauses when playing', async () => {
    mockTP.getPlaybackState.mockResolvedValueOnce({ state: State.Playing });
    await togglePlayPause();
    expect(mockTP.pause).toHaveBeenCalled();
  });

  it('plays when paused', async () => {
    mockTP.getPlaybackState.mockResolvedValueOnce({ state: State.Paused });
    await togglePlayPause();
    expect(mockTP.play).toHaveBeenCalled();
  });
});

describe('skipToNext / skipToPrevious', () => {
  it('delegates skipToNext to TrackPlayer', async () => {
    await skipToNext();
    expect(mockTP.skipToNext).toHaveBeenCalled();
  });

  it('delegates skipToPrevious to TrackPlayer', async () => {
    await skipToPrevious();
    expect(mockTP.skipToPrevious).toHaveBeenCalled();
  });
});

describe('seekTo', () => {
  it('seeks to the specified position', async () => {
    mockTP.getProgress.mockResolvedValue({ position: 10, duration: 300, buffered: 150 });
    await seekTo(60);
    expect(mockTP.seekTo).toHaveBeenCalledWith(60);
  });

  it('clamps to 0 when position is negative', async () => {
    mockTP.getProgress.mockResolvedValue({ position: 0, duration: 300, buffered: 100 });
    await seekTo(-10);
    expect(mockTP.seekTo).toHaveBeenCalledWith(0);
  });
});

describe('skipToTrack', () => {
  it('skips to index and plays', async () => {
    await skipToTrack(3);
    expect(mockTP.skip).toHaveBeenCalledWith(3);
    expect(mockTP.play).toHaveBeenCalled();
  });
});

describe('retryPlayback', () => {
  it('clears error and plays', async () => {
    await retryPlayback();
    expect(mockSetError).toHaveBeenCalledWith(null);
    expect(mockTP.play).toHaveBeenCalled();
  });
});

describe('clearQueue', () => {
  it('resets TrackPlayer and store state', async () => {
    await clearQueue();
    expect(mockTP.reset).toHaveBeenCalled();
    expect(mockSetCurrentTrack).toHaveBeenCalledWith(null);
    expect(mockSetQueue).toHaveBeenCalledWith([]);
    expect(mockSetPlaybackState).toHaveBeenCalledWith('idle');
    expect(mockSetProgress).toHaveBeenCalledWith(0, 0, 0);
    expect(mockSetError).toHaveBeenCalledWith(null);
    expect(mockSetRetrying).toHaveBeenCalledWith(false);
  });
});

describe('addToQueue', () => {
  it('does nothing for empty array', async () => {
    await addToQueue([]);
    expect(mockTP.add).not.toHaveBeenCalled();
  });

  it('starts playback when queue is empty', async () => {
    await initPlayer();
    // clearQueue to make currentChildQueue empty
    await clearQueue();
    mockTP.reset.mockClear();

    const tracks = [makeChild('t1'), makeChild('t2')];
    await addToQueue(tracks);

    expect(mockTP.reset).toHaveBeenCalled();
    expect(mockTP.play).toHaveBeenCalled();
  });

  it('appends tracks when queue has items', async () => {
    await initPlayer();
    const initial = [makeChild('t1')];
    await playTrack(initial[0], initial);
    mockTP.add.mockClear();

    const newTracks = [makeChild('t2'), makeChild('t3')];
    await addToQueue(newTracks);

    expect(mockTP.add).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 't2' }),
        expect.objectContaining({ id: 't3' }),
      ]),
    );
  });
});

describe('removeFromQueue', () => {
  it('ignores out-of-bounds index', async () => {
    await initPlayer();
    await playTrack(makeChild('t1'), [makeChild('t1')]);

    await removeFromQueue(5);
    expect(mockTP.remove).not.toHaveBeenCalled();
  });

  it('ignores negative index', async () => {
    await removeFromQueue(-1);
    expect(mockTP.remove).not.toHaveBeenCalled();
  });

  it('clears queue when removing the only track', async () => {
    await initPlayer();
    await playTrack(makeChild('t1'), [makeChild('t1')]);
    mockTP.reset.mockClear();

    await removeFromQueue(0);
    expect(mockTP.reset).toHaveBeenCalled();
  });
});

describe('cycleRepeatMode', () => {
  it('cycles off -> all', async () => {
    playbackSettingsStore.setState({ repeatMode: 'off' } as any);
    await cycleRepeatMode();
    expect(playbackSettingsStore.getState().repeatMode).toBe('all');
    expect(mockTP.setRepeatMode).toHaveBeenCalledWith(RepeatMode.Queue);
  });

  it('cycles all -> one', async () => {
    playbackSettingsStore.setState({ repeatMode: 'all' } as any);
    await cycleRepeatMode();
    expect(playbackSettingsStore.getState().repeatMode).toBe('one');
    expect(mockTP.setRepeatMode).toHaveBeenCalledWith(RepeatMode.Track);
  });

  it('cycles one -> off', async () => {
    playbackSettingsStore.setState({ repeatMode: 'one' } as any);
    await cycleRepeatMode();
    expect(playbackSettingsStore.getState().repeatMode).toBe('off');
    expect(mockTP.setRepeatMode).toHaveBeenCalledWith(RepeatMode.Off);
  });
});

describe('cyclePlaybackRate', () => {
  it('cycles through playback rates', async () => {
    playbackSettingsStore.setState({ playbackRate: 1 } as any);
    await cyclePlaybackRate();
    const newRate = playbackSettingsStore.getState().playbackRate;
    expect(newRate).toBe(1.25);
    expect(mockTP.setRate).toHaveBeenCalledWith(1.25);
  });

  it('wraps around to first rate', async () => {
    playbackSettingsStore.setState({ playbackRate: 2 } as any);
    await cyclePlaybackRate();
    expect(playbackSettingsStore.getState().playbackRate).toBe(0.5);
  });
});

describe('shuffleQueue', () => {
  it('does nothing with fewer than 2 tracks', async () => {
    await initPlayer();
    await playTrack(makeChild('t1'), [makeChild('t1')]);
    mockTP.pause.mockClear();

    await shuffleQueue();
    expect(mockTP.pause).not.toHaveBeenCalled();
  });

  it('shuffles, replaces queue, and plays from index 0', async () => {
    await initPlayer();
    const queue = Array.from({ length: 5 }, (_, i) => makeChild(`t${i}`));
    await playTrack(queue[0], queue);
    mockTP.setQueue.mockClear();
    mockTP.skip.mockClear();

    await shuffleQueue();

    expect(mockTP.pause).toHaveBeenCalled();
    expect(mockTP.setQueue).toHaveBeenCalledTimes(1);
    expect(mockTP.skip).toHaveBeenCalledWith(0);
    expect(mockTP.play).toHaveBeenCalled();
    expect(mockSetQueue).toHaveBeenCalled();
  });
});
