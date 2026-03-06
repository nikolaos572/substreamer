import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { Event, State } from '../constants';
import { useActiveTrack } from '../hooks/useActiveTrack';
import { useAppIsInBackground } from '../hooks/useAppIsInBackground';
import { useIsPlaying, isPlaying } from '../hooks/useIsPlaying';
import { usePlayWhenReady } from '../hooks/usePlayWhenReady';
import { usePlaybackState } from '../hooks/usePlaybackState';
import { useProgress } from '../hooks/useProgress';
import { useTrackPlayerEvents } from '../hooks/useTrackPlayerEvents';

jest.mock('../NativeTrackPlayer');

type Listener = (...args: any[]) => void;
const mockListenerMap: Record<string, Listener[]> = {};

function emitEvent(event: string, payload: any) {
  mockListenerMap[event]?.forEach((l) => l(payload));
}

const mockAddEventListener = jest.fn((event: string, listener: Listener) => {
  if (!mockListenerMap[event]) mockListenerMap[event] = [];
  mockListenerMap[event].push(listener);
  return {
    remove: jest.fn(() => {
      const idx = mockListenerMap[event]?.indexOf(listener) ?? -1;
      if (idx >= 0) mockListenerMap[event]!.splice(idx, 1);
    }),
  };
});

const mockGetActiveTrack = jest.fn().mockResolvedValue(undefined);
const mockGetPlaybackState = jest.fn().mockResolvedValue({ state: 'none' });
const mockGetPlayWhenReady = jest.fn().mockResolvedValue(false);
const mockGetProgress = jest.fn().mockResolvedValue({ position: 0, duration: 0, buffered: 0 });

jest.mock('../trackPlayer', () => ({
  addEventListener: (...args: [string, Listener]) => mockAddEventListener(...args),
  getActiveTrack: () => mockGetActiveTrack(),
  getPlaybackState: () => mockGetPlaybackState(),
  getPlayWhenReady: () => mockGetPlayWhenReady(),
  getProgress: () => mockGetProgress(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  for (const key of Object.keys(mockListenerMap)) {
    delete mockListenerMap[key];
  }
  mockGetActiveTrack.mockResolvedValue(undefined);
  mockGetPlaybackState.mockResolvedValue({ state: 'none' });
  mockGetPlayWhenReady.mockResolvedValue(false);
  mockGetProgress.mockResolvedValue({ position: 0, duration: 0, buffered: 0 });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// -- useAppIsInBackground --

describe('useAppIsInBackground', () => {
  let appStateListeners: ((state: AppStateStatus) => void)[] = [];

  beforeEach(() => {
    appStateListeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(
      (_type, listener) => {
        appStateListeners.push(listener as (state: AppStateStatus) => void);
        return { remove: jest.fn(() => {
          const idx = appStateListeners.indexOf(listener as (state: AppStateStatus) => void);
          if (idx >= 0) appStateListeners.splice(idx, 1);
        }) } as ReturnType<typeof AppState.addEventListener>;
      },
    );
  });

  it('returns false initially (active state)', () => {
    const { result } = renderHook(() => useAppIsInBackground());
    expect(result.current).toBe(false);
  });

  it('returns true when app enters background', () => {
    const { result } = renderHook(() => useAppIsInBackground());

    act(() => {
      appStateListeners.forEach((l) => l('background'));
    });

    expect(result.current).toBe(true);
  });

  it('returns false when app comes back to active', () => {
    const { result } = renderHook(() => useAppIsInBackground());

    act(() => {
      appStateListeners.forEach((l) => l('background'));
    });
    expect(result.current).toBe(true);

    act(() => {
      appStateListeners.forEach((l) => l('active'));
    });
    expect(result.current).toBe(false);
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useAppIsInBackground());

    expect(appStateListeners).toHaveLength(1);
    unmount();
    expect(appStateListeners).toHaveLength(0);
  });
});

// -- useActiveTrack --

describe('useActiveTrack', () => {
  it('returns undefined initially', () => {
    const { result } = renderHook(() => useActiveTrack());

    expect(result.current).toBeUndefined();
  });

  it('fetches initial active track', async () => {
    const track = { url: 'https://x.com/s.mp3', title: 'Song' };
    mockGetActiveTrack.mockResolvedValue(track);

    const { result } = renderHook(() => useActiveTrack());

    await waitFor(() => {
      expect(result.current).toEqual(track);
    });
  });

  it('updates when PlaybackActiveTrackChanged fires', async () => {
    const { result } = renderHook(() => useActiveTrack());

    const newTrack = { url: 'https://x.com/new.mp3', title: 'New' };
    act(() => {
      emitEvent(Event.PlaybackActiveTrackChanged, { track: newTrack });
    });

    expect(result.current).toEqual(newTrack);
  });

  it('sets undefined when track is null in event', async () => {
    const initialTrack = { url: 'https://x.com/s.mp3', title: 'Song' };
    mockGetActiveTrack.mockResolvedValue(initialTrack);

    const { result } = renderHook(() => useActiveTrack());

    await waitFor(() => {
      expect(result.current).toEqual(initialTrack);
    });

    act(() => {
      emitEvent(Event.PlaybackActiveTrackChanged, { track: null });
    });

    expect(result.current).toBeUndefined();
  });

  it('does not overwrite event-set track when fetch resolves late', async () => {
    let resolveFetch!: (v: any) => void;
    mockGetActiveTrack.mockImplementation(
      () => new Promise((r) => { resolveFetch = r; })
    );

    const { result } = renderHook(() => useActiveTrack());

    const eventTrack = { url: 'https://x.com/event.mp3', title: 'Event' };
    act(() => {
      emitEvent(Event.PlaybackActiveTrackChanged, { track: eventTrack });
    });
    expect(result.current).toEqual(eventTrack);

    await act(async () => { resolveFetch({ url: 'https://x.com/stale.mp3', title: 'Stale' }); });

    expect(result.current).toEqual(eventTrack);
  });

  it('skips state update when unmounted before fetch resolves', async () => {
    let resolveFetch!: (v: any) => void;
    mockGetActiveTrack.mockImplementation(
      () => new Promise((r) => { resolveFetch = r; })
    );

    const { result, unmount } = renderHook(() => useActiveTrack());
    unmount();

    await act(async () => { resolveFetch({ url: 'https://x.com/late.mp3', title: 'Late' }); });

    expect(result.current).toBeUndefined();
  });
});

// -- usePlaybackState --

describe('usePlaybackState', () => {
  it('returns { state: undefined } initially', () => {
    const { result } = renderHook(() => usePlaybackState());

    expect(result.current).toEqual({ state: undefined });
  });

  it('fetches initial state', async () => {
    mockGetPlaybackState.mockResolvedValue({ state: 'playing' });
    const { result } = renderHook(() => usePlaybackState());

    await waitFor(() => {
      expect(result.current).toEqual({ state: 'playing' });
    });
  });

  it('updates on PlaybackState event', async () => {
    const { result } = renderHook(() => usePlaybackState());

    act(() => {
      emitEvent(Event.PlaybackState, { state: 'paused' });
    });

    expect(result.current).toEqual({ state: 'paused' });
  });

  it('keeps event-set state when fetch resolves late', async () => {
    let resolveFetch!: (v: any) => void;
    mockGetPlaybackState.mockImplementation(
      () => new Promise((r) => { resolveFetch = r; })
    );

    const { result } = renderHook(() => usePlaybackState());

    act(() => {
      emitEvent(Event.PlaybackState, { state: 'paused' });
    });
    expect(result.current).toEqual({ state: 'paused' });

    await act(async () => { resolveFetch({ state: 'playing' }); });

    expect(result.current).toEqual({ state: 'paused' });
  });

  it('skips state update when unmounted before fetch resolves', async () => {
    let resolveFetch!: (v: any) => void;
    mockGetPlaybackState.mockImplementation(
      () => new Promise((r) => { resolveFetch = r; })
    );

    const { result, unmount } = renderHook(() => usePlaybackState());
    unmount();

    await act(async () => { resolveFetch({ state: 'playing' }); });

    expect(result.current).toEqual({ state: undefined });
  });
});

// -- usePlayWhenReady --

describe('usePlayWhenReady', () => {
  it('returns undefined initially', () => {
    const { result } = renderHook(() => usePlayWhenReady());

    expect(result.current).toBeUndefined();
  });

  it('fetches initial value', async () => {
    mockGetPlayWhenReady.mockResolvedValue(true);
    const { result } = renderHook(() => usePlayWhenReady());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('updates on PlaybackPlayWhenReadyChanged event', async () => {
    const { result } = renderHook(() => usePlayWhenReady());

    act(() => {
      emitEvent(Event.PlaybackPlayWhenReadyChanged, { playWhenReady: true });
    });

    expect(result.current).toBe(true);
  });

  it('keeps event-set value when fetch resolves late', async () => {
    let resolveFetch!: (v: boolean) => void;
    mockGetPlayWhenReady.mockImplementation(
      () => new Promise((r) => { resolveFetch = r; })
    );

    const { result } = renderHook(() => usePlayWhenReady());

    act(() => {
      emitEvent(Event.PlaybackPlayWhenReadyChanged, { playWhenReady: true });
    });
    expect(result.current).toBe(true);

    await act(async () => { resolveFetch(false); });

    expect(result.current).toBe(true);
  });

  it('skips state update when unmounted before fetch resolves', async () => {
    let resolveFetch!: (v: boolean) => void;
    mockGetPlayWhenReady.mockImplementation(
      () => new Promise((r) => { resolveFetch = r; })
    );

    const { result, unmount } = renderHook(() => usePlayWhenReady());
    unmount();

    await act(async () => { resolveFetch(true); });

    expect(result.current).toBeUndefined();
  });
});

// -- useProgress --

describe('useProgress', () => {
  it('returns initial state with zeroes', () => {
    const { result, unmount } = renderHook(() => useProgress(1000));

    expect(result.current).toEqual({ position: 0, duration: 0, buffered: 0 });
    unmount();
  });

  it('polls and updates progress', async () => {
    mockGetProgress.mockResolvedValue({ position: 30, duration: 180, buffered: 60 });
    const { result, unmount } = renderHook(() => useProgress(1000));

    await waitFor(() => {
      expect(result.current.position).toBe(30);
    });
    unmount();
  });

  it('resets on track change', async () => {
    mockGetProgress.mockResolvedValue({ position: 30, duration: 180, buffered: 60 });
    const { result, unmount } = renderHook(() => useProgress(1000));

    await waitFor(() => {
      expect(result.current.position).toBe(30);
    });

    act(() => {
      emitEvent(Event.PlaybackActiveTrackChanged, { track: { url: 'new.mp3' } });
    });

    expect(result.current).toEqual({ position: 0, duration: 0, buffered: 0 });
    unmount();
  });

  it('skips state update when progress values are unchanged', async () => {
    const progress = { position: 30, duration: 180, buffered: 60 };
    mockGetProgress.mockResolvedValue(progress);
    const { result, unmount } = renderHook(() => useProgress(1000));

    await waitFor(() => {
      expect(result.current.position).toBe(30);
    });

    const firstResult = result.current;

    act(() => { jest.advanceTimersByTime(1000); });
    await waitFor(() => {
      expect(mockGetProgress).toHaveBeenCalledTimes(2);
    });

    expect(result.current).toBe(firstResult);
    unmount();
  });

  it('handles getProgress rejection gracefully', async () => {
    mockGetProgress.mockRejectedValue(new Error('not setup'));
    const { result, unmount } = renderHook(() => useProgress(1000));

    act(() => { jest.advanceTimersByTime(1000); });
    await waitFor(() => {
      expect(mockGetProgress).toHaveBeenCalled();
    });

    expect(result.current).toEqual({ position: 0, duration: 0, buffered: 0 });
    unmount();
  });

  it('stops polling after unmount', async () => {
    mockGetProgress.mockResolvedValue({ position: 10, duration: 100, buffered: 20 });
    const { result, unmount } = renderHook(() => useProgress(1000));

    await waitFor(() => {
      expect(result.current.position).toBe(10);
    });

    const callCount = mockGetProgress.mock.calls.length;
    unmount();

    act(() => { jest.advanceTimersByTime(5000); });

    expect(mockGetProgress.mock.calls.length).toBe(callCount);
  });
});

// -- useIsPlaying --

describe('useIsPlaying', () => {
  it('returns undefined playing/bufferingDuringPlay when state unknown', () => {
    const { result } = renderHook(() => useIsPlaying());

    expect(result.current.playing).toBeUndefined();
    expect(result.current.bufferingDuringPlay).toBeUndefined();
  });

  it('returns playing=true when playWhenReady and state is Playing', async () => {
    mockGetPlaybackState.mockResolvedValue({ state: State.Playing });
    mockGetPlayWhenReady.mockResolvedValue(true);
    const { result } = renderHook(() => useIsPlaying());

    await waitFor(() => {
      expect(result.current.playing).toBe(true);
    });
  });

  it('returns playing=false when state is Error', async () => {
    mockGetPlaybackState.mockResolvedValue({ state: State.Error });
    mockGetPlayWhenReady.mockResolvedValue(true);
    const { result } = renderHook(() => useIsPlaying());

    await waitFor(() => {
      expect(result.current.playing).toBe(false);
    });
  });

  it('returns bufferingDuringPlay=true when buffering and playWhenReady', async () => {
    mockGetPlaybackState.mockResolvedValue({ state: State.Buffering });
    mockGetPlayWhenReady.mockResolvedValue(true);
    const { result } = renderHook(() => useIsPlaying());

    await waitFor(() => {
      expect(result.current.bufferingDuringPlay).toBe(true);
    });
  });
});

// -- isPlaying (non-hook) --

describe('isPlaying', () => {
  it('returns playing status from current state', async () => {
    mockGetPlaybackState.mockResolvedValue({ state: State.Playing });
    mockGetPlayWhenReady.mockResolvedValue(true);

    const result = await isPlaying();

    expect(result.playing).toBe(true);
    expect(result.bufferingDuringPlay).toBe(false);
  });

  it('returns not playing when paused', async () => {
    mockGetPlaybackState.mockResolvedValue({ state: State.Paused });
    mockGetPlayWhenReady.mockResolvedValue(false);

    const result = await isPlaying();

    expect(result.playing).toBe(false);
  });
});

// -- useTrackPlayerEvents --

describe('useTrackPlayerEvents', () => {
  it('subscribes to specified events', () => {
    const handler = jest.fn();
    renderHook(() => useTrackPlayerEvents([Event.PlaybackState], handler));

    expect(mockListenerMap[Event.PlaybackState]).toBeDefined();
    expect(mockListenerMap[Event.PlaybackState]).toHaveLength(1);
  });

  it('fires handler with payload and type', () => {
    const handler = jest.fn();
    renderHook(() => useTrackPlayerEvents([Event.PlaybackState], handler));

    act(() => {
      emitEvent(Event.PlaybackState, { state: 'playing' });
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'playing', type: Event.PlaybackState }),
    );
  });

  it('cleans up subscriptions on unmount', () => {
    const handler = jest.fn();
    const { unmount } = renderHook(() =>
      useTrackPlayerEvents([Event.PlaybackState, Event.PlaybackError], handler),
    );

    expect(mockListenerMap[Event.PlaybackState]).toHaveLength(1);
    expect(mockListenerMap[Event.PlaybackError]).toHaveLength(1);

    unmount();

    expect(mockListenerMap[Event.PlaybackState]).toHaveLength(0);
    expect(mockListenerMap[Event.PlaybackError]).toHaveLength(0);
  });

  it('subscribes to multiple events', () => {
    const handler = jest.fn();
    renderHook(() =>
      useTrackPlayerEvents(
        [Event.PlaybackState, Event.PlaybackActiveTrackChanged],
        handler,
      ),
    );

    expect(mockListenerMap[Event.PlaybackState]).toHaveLength(1);
    expect(mockListenerMap[Event.PlaybackActiveTrackChanged]).toHaveLength(1);
  });

  it('warns about invalid event types in __DEV__', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const handler = jest.fn();
    const bogusEvent = 'totally-bogus-event' as Event;

    renderHook(() => useTrackPlayerEvents([bogusEvent], handler));

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('not a valid TrackPlayer event'),
    );

    warnSpy.mockRestore();
  });

  it('does not warn when all event types are valid', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const handler = jest.fn();

    renderHook(() => useTrackPlayerEvents([Event.PlaybackState], handler));

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
