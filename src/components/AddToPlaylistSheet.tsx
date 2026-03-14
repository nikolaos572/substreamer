import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../hooks/useTheme';
import { syncCachedItemTracks } from '../services/musicCacheService';
import {
  addToPlaylist,
  createNewPlaylist,
  getAlbum,
} from '../services/subsonicService';
import {
  addToPlaylistStore,
  type AddToPlaylistTarget,
} from '../store/addToPlaylistStore';
import { musicCacheStore } from '../store/musicCacheStore';
import { playlistDetailStore } from '../store/playlistDetailStore';
import { playlistLibraryStore } from '../store/playlistLibraryStore';
import { processingOverlayStore } from '../store/processingOverlayStore';

import type { Playlist } from '../services/subsonicService';

/**
 * Resolve the song IDs to add from a target.
 * For songs this is immediate; for albums we fetch the full track list.
 */
async function resolveSongIds(target: AddToPlaylistTarget): Promise<string[] | null> {
  if (target.type === 'song') return [target.item.id];
  if (target.type === 'queue') {
    if (target.songs.length === 0) return null;
    return target.songs.map((s) => s.id);
  }
  const full = await getAlbum(target.item.id);
  if (!full?.song?.length) return null;
  return full.song.map((s) => s.id);
}

function getSubtitleText(target: AddToPlaylistTarget): string {
  if (target.type === 'song') {
    const title = target.item.title ?? 'Unknown Song';
    const artist = target.item.artist ?? 'Unknown Artist';
    return `${title} — ${artist}`;
  }
  if (target.type === 'queue') {
    const count = target.songs.length;
    return count === 1 ? '1 track from queue' : `${count} tracks from queue`;
  }
  const name = target.item.name ?? 'Unknown Album';
  const artist = target.item.artist ?? 'Unknown Artist';
  return `${name} — ${artist}`;
}

export function AddToPlaylistSheet() {
  const visible = addToPlaylistStore((s) => s.visible);
  const target = addToPlaylistStore((s) => s.target);
  const hide = addToPlaylistStore((s) => s.hide);
  const playlists = playlistLibraryStore((s) => s.playlists);
  const playlistsLoading = playlistLibraryStore((s) => s.loading);
  const playlistsFetchError = playlistLibraryStore((s) => s.error);

  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Fetch fresh playlists every time the sheet opens
  useEffect(() => {
    if (visible) {
      playlistLibraryStore.getState().fetchAllPlaylists();
    }
  }, [visible]);

  const [mode, setMode] = useState<'pick' | 'create'>('pick');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    hide();
    setMode('pick');
    setName('');
    setBusy(false);
    setError(null);
  }, [hide]);

  const handleSelectPlaylist = useCallback(
    async (playlist: Playlist) => {
      if (!target || busy) return;
      setBusy(true);
      setError(null);
      handleClose();
      processingOverlayStore.getState().show('Adding…');

      try {
        const songIds = await resolveSongIds(target);
        if (!songIds) throw new Error('Could not resolve songs');

        const success = await addToPlaylist(playlist.id, songIds);
        if (!success) throw new Error('API returned false');

        if (playlist.id in playlistDetailStore.getState().playlists) {
          const updated = await playlistDetailStore.getState().fetchPlaylist(playlist.id);
          if (updated && playlist.id in musicCacheStore.getState().cachedItems) {
            syncCachedItemTracks(playlist.id, updated.entry ?? []);
          }
        }

        playlistLibraryStore.getState().fetchAllPlaylists();
        processingOverlayStore.getState().showSuccess('Added to Playlist');
      } catch {
        processingOverlayStore.getState().showError('Failed to add to playlist');
      }
    },
    [target, busy, handleClose],
  );

  const handleCreatePlaylist = useCallback(async () => {
    if (!target || busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a playlist name');
      return;
    }
    setBusy(true);
    setError(null);

    try {
      const songIds = await resolveSongIds(target);
      if (!songIds) throw new Error('Could not resolve songs');

      const success = await createNewPlaylist(trimmed, songIds);
      if (!success) throw new Error('API returned false');

      handleClose();
      playlistLibraryStore.getState().fetchAllPlaylists();
      processingOverlayStore.getState().show('Creating…');
      processingOverlayStore.getState().showSuccess('Playlist Created');
    } catch {
      setBusy(false);
      setError('Failed to create playlist');
    }
  }, [target, busy, name, handleClose]);

  const handleShowCreate = useCallback(() => {
    setMode('create');
    setError(null);
  }, []);

  const handleBackToPick = useCallback(() => {
    setMode('pick');
    setName('');
    setError(null);
  }, []);

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        sheet: {
          backgroundColor: colors.card,
          paddingBottom: Math.max(insets.bottom, 16),
        },
        handle: { backgroundColor: colors.border },
        title: { color: colors.textPrimary },
        subtitle: { color: colors.textSecondary },
        input: {
          backgroundColor: colors.inputBg,
          color: colors.textPrimary,
          borderColor: colors.border,
        },
        createButton: { backgroundColor: colors.primary },
        errorText: { color: colors.red },
        playlistName: { color: colors.textPrimary },
        playlistCount: { color: colors.textSecondary },
        newPlaylistLabel: { color: colors.primary },
        separator: { backgroundColor: colors.border },
      }),
    [colors, insets.bottom],
  );

  const subtitle = target ? getSubtitleText(target) : '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose} />

      <View style={[styles.sheet, dynamicStyles.sheet]}>
        <View style={[styles.handle, dynamicStyles.handle]} />

        <Text style={[styles.title, dynamicStyles.title]} numberOfLines={1}>
          Add to Playlist
        </Text>
        <Text style={[styles.subtitle, dynamicStyles.subtitle]} numberOfLines={1}>
          {subtitle}
        </Text>

        {mode === 'pick' ? (
          <ScrollView
            style={styles.listContainer}
            contentContainerStyle={styles.listContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {/* New Playlist row */}
            <Pressable
              onPress={handleShowCreate}
              style={({ pressed }) => [
                styles.playlistRow,
                pressed && styles.rowPressed,
              ]}
            >
              <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
              <Text style={[styles.newPlaylistLabel, dynamicStyles.newPlaylistLabel]}>
                New Playlist
              </Text>
            </Pressable>

            <View style={[styles.separator, dynamicStyles.separator]} />

            {playlists.map((playlist) => (
              <Pressable
                key={playlist.id}
                onPress={() => handleSelectPlaylist(playlist)}
                disabled={busy}
                style={({ pressed }) => [
                  styles.playlistRow,
                  pressed && styles.rowPressed,
                ]}
              >
                <Ionicons name="list-outline" size={22} color={colors.textSecondary} />
                <View style={styles.playlistInfo}>
                  <Text
                    style={[styles.playlistName, dynamicStyles.playlistName]}
                    numberOfLines={1}
                  >
                    {playlist.name}
                  </Text>
                  <Text style={[styles.playlistCount, dynamicStyles.playlistCount]}>
                    {playlist.songCount === 1 ? '1 track' : `${playlist.songCount ?? 0} tracks`}
                  </Text>
                </View>
              </Pressable>
            ))}

            {playlists.length === 0 && playlistsLoading && (
              <ActivityIndicator style={styles.loadingIndicator} color={colors.textSecondary} />
            )}

            {playlists.length === 0 && !playlistsLoading && !playlistsFetchError && (
              <Text style={[styles.emptyText, dynamicStyles.playlistCount]}>
                No playlists yet
              </Text>
            )}

            {playlistsFetchError && playlists.length === 0 && !playlistsLoading && (
              <Text style={[styles.emptyText, dynamicStyles.errorText]}>
                Failed to load playlists
              </Text>
            )}

            {playlists.length > 0 && playlistsLoading && (
              <ActivityIndicator style={styles.loadingIndicator} size="small" color={colors.textSecondary} />
            )}
          </ScrollView>
        ) : (
          <View style={styles.formSection}>
            {/* Back arrow */}
            <Pressable onPress={handleBackToPick} style={styles.backButton}>
              <Ionicons name="arrow-back" size={20} color={colors.primary} />
              <Text style={[styles.backLabel, { color: colors.primary }]}>Back</Text>
            </Pressable>

            <Text style={[styles.label, dynamicStyles.subtitle]}>Playlist Name</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              value={name}
              onChangeText={setName}
              placeholder="Enter playlist name…"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="done"
              autoFocus
              editable={!busy}
              onSubmitEditing={handleCreatePlaylist}
            />

            {error && (
              <Text style={[styles.errorText, dynamicStyles.errorText]}>{error}</Text>
            )}

            <Pressable
              onPress={handleCreatePlaylist}
              disabled={busy}
              style={({ pressed }) => [
                styles.createButton,
                dynamicStyles.createButton,
                pressed && styles.buttonPressed,
                busy && styles.buttonDisabled,
              ]}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="add-outline" size={18} color="#fff" />
                  <Text style={styles.createButtonText}>Create Playlist</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingHorizontal: 16,
    maxHeight: '70%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  listContainer: {
    flexShrink: 1,
  },
  listContent: {
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  rowPressed: {
    opacity: 0.6,
  },
  playlistInfo: {
    flex: 1,
    minWidth: 0,
  },
  playlistName: {
    fontSize: 16,
    fontWeight: '500',
  },
  playlistCount: {
    fontSize: 13,
    marginTop: 1,
  },
  newPlaylistLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  loadingIndicator: {
    paddingVertical: 16,
  },
  formSection: {
    paddingHorizontal: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  backLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 14,
    marginTop: 12,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
    marginBottom: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
