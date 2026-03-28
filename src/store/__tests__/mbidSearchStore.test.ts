import { mbidSearchStore } from '../mbidSearchStore';

beforeEach(() => {
  mbidSearchStore.setState({
    visible: false,
    artistId: null,
    artistName: null,
    currentMbid: null,
    coverArtId: null,
  });
});

describe('mbidSearchStore', () => {
  it('show sets all fields', () => {
    mbidSearchStore.getState().show('ar1', 'Radiohead', 'mbid-123');
    const state = mbidSearchStore.getState();
    expect(state.visible).toBe(true);
    expect(state.artistId).toBe('ar1');
    expect(state.artistName).toBe('Radiohead');
    expect(state.currentMbid).toBe('mbid-123');
    expect(state.coverArtId).toBeNull();
  });

  it('show with coverArtId', () => {
    mbidSearchStore.getState().show('ar1', 'Radiohead', 'mbid-123', 'cover-1');
    const state = mbidSearchStore.getState();
    expect(state.coverArtId).toBe('cover-1');
  });

  it('show with null currentMbid', () => {
    mbidSearchStore.getState().show('ar1', 'Radiohead', null);
    expect(mbidSearchStore.getState().currentMbid).toBeNull();
  });

  it('hide resets all fields including coverArtId', () => {
    mbidSearchStore.getState().show('ar1', 'Radiohead', 'mbid-123', 'cover-1');
    mbidSearchStore.getState().hide();
    const state = mbidSearchStore.getState();
    expect(state.visible).toBe(false);
    expect(state.artistId).toBeNull();
    expect(state.artistName).toBeNull();
    expect(state.currentMbid).toBeNull();
    expect(state.coverArtId).toBeNull();
  });
});
