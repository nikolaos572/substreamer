import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../hooks/useTheme';
import {
  ensureCoverArtAuth,
  getCoverArtUrl,
  getFrequentlyPlayedAlbums,
  getRandomAlbums,
  getRecentlyAddedAlbums,
  getRecentlyPlayedAlbums,
  type AlbumID3,
} from '../services/subsonicService';
import type { AlbumListType } from '../store/albumListsStore';

const SIZE_SEE_MORE = 100;
const COVER_SIZE = 300;

const TYPE_TO_GETTER: Record<
  AlbumListType,
  (size: number) => Promise<AlbumID3[]>
> = {
  recentlyAdded: getRecentlyAddedAlbums,
  recentlyPlayed: getRecentlyPlayedAlbums,
  frequentlyPlayed: getFrequentlyPlayedAlbums,
  randomSelection: getRandomAlbums,
};

const TYPE_TO_TITLE: Record<AlbumListType, string> = {
  recentlyAdded: 'Recently Added',
  recentlyPlayed: 'Recently Played',
  frequentlyPlayed: 'Frequently Played',
  randomSelection: 'Random Selection',
};

const VALID_TYPES: AlbumListType[] = [
  'recentlyAdded',
  'recentlyPlayed',
  'frequentlyPlayed',
  'randomSelection',
];

function AlbumRow({
  album,
  colors,
}: {
  album: AlbumID3;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const router = useRouter();
  const uri = getCoverArtUrl(album.coverArt ?? '', COVER_SIZE) ?? undefined;
  return (
    <Pressable
      onPress={() => router.push(`/album/${album.id}`)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.card },
        pressed && styles.rowPressed,
      ]}
    >
      <Image source={{ uri }} style={styles.rowCover} resizeMode="cover" />
      <View style={styles.rowText}>
        <Text style={[styles.rowAlbumName, { color: colors.textPrimary }]} numberOfLines={1}>
          {album.name}
        </Text>
        <Text style={[styles.rowArtistName, { color: colors.textSecondary }]} numberOfLines={1}>
          {album.artist ?? 'Unknown Artist'}
        </Text>
      </View>
    </Pressable>
  );
}

export function AlbumListScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ type?: string }>();
  const type = (VALID_TYPES.includes(params.type as AlbumListType)
    ? params.type
    : 'recentlyAdded') as AlbumListType;

  const [albums, setAlbums] = useState<AlbumID3[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: TYPE_TO_TITLE[type] });
  }, [type, navigation]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await ensureCoverArtAuth();
        if (cancelled) return;
        const getter = TYPE_TO_GETTER[type];
        const list = await getter(SIZE_SEE_MORE);
        if (cancelled) return;
        setAlbums(list);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load albums');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type]);

  const renderItem = useCallback(
    ({ item }: { item: AlbumID3 }) => <AlbumRow album={item} colors={colors} />,
    [colors]
  );
  const keyExtractor = useCallback((item: AlbumID3) => item.id, []);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={albums}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No albums
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowCover: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  rowText: {
    flex: 1,
    marginLeft: 12,
  },
  rowAlbumName: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowArtistName: {
    fontSize: 14,
    marginTop: 2,
  },
  errorText: {
    fontSize: 16,
  },
  emptyText: {
    fontSize: 16,
  },
});
