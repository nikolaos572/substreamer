import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../hooks/useTheme';
import { getCoverArtUrl, type AlbumID3 } from '../services/subsonicService';
import {
  albumListsStore,
  type AlbumListType,
} from '../store/albumListsStore';

const CARD_WIDTH = 150;
const CARD_GAP = 12;
const COVER_SIZE = 300;

function AlbumCard({
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
        styles.card,
        { backgroundColor: colors.card },
        pressed && styles.cardPressed,
      ]}
    >
      <Image
        source={{ uri }}
        style={styles.cover}
        resizeMode="cover"
      />
      <Text style={[styles.albumName, { color: colors.textPrimary }]} numberOfLines={1}>
        {album.name}
      </Text>
      <Text style={[styles.artistName, { color: colors.textSecondary }]} numberOfLines={1}>
        {album.artist ?? 'Unknown Artist'}
      </Text>
    </Pressable>
  );
}

const SECTION_CONFIG: Record<
  AlbumListType,
  { title: string; emptyMessage: string; refresh: () => Promise<void> }
> = {
  recentlyAdded: {
    title: 'Recently Added',
    emptyMessage: 'No recent albums',
    refresh: () => albumListsStore.getState().refreshRecentlyAdded(),
  },
  recentlyPlayed: {
    title: 'Recently Played',
    emptyMessage: 'No recently played albums',
    refresh: () => albumListsStore.getState().refreshRecentlyPlayed(),
  },
  frequentlyPlayed: {
    title: 'Frequently Played',
    emptyMessage: 'No frequently played albums',
    refresh: () => albumListsStore.getState().refreshFrequentlyPlayed(),
  },
  randomSelection: {
    title: 'Random Selection',
    emptyMessage: 'No albums',
    refresh: () => albumListsStore.getState().refreshRandomSelection(),
  },
};

function AlbumSection({
  listType,
  albums,
  colors,
}: {
  listType: AlbumListType;
  albums: AlbumID3[];
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const router = useRouter();
  const config = SECTION_CONFIG[listType];
  const renderItem = useCallback(
    ({ item }: { item: AlbumID3 }) => <AlbumCard album={item} colors={colors} />,
    [colors]
  );
  const keyExtractor = useCallback((item: AlbumID3) => item.id, []);
  const onRefresh = useCallback(() => {
    config.refresh();
  }, [listType]);
  const onSeeMore = useCallback(() => {
    router.push({ pathname: '/album-list', params: { type: listType } });
  }, [listType, router]);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {config.title}
        </Text>
        <View style={styles.sectionHeaderActions}>
          <Pressable
            onPress={onRefresh}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
            hitSlop={8}
          >
            <Ionicons
              name="refresh"
              size={22}
              color={colors.textSecondary}
            />
          </Pressable>
          <Pressable
            onPress={onSeeMore}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
            hitSlop={8}
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>
      </View>
      {albums.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {config.emptyMessage}
        </Text>
      ) : (
        <FlatList
          data={albums}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
        />
      )}
    </View>
  );
}

export function HomeScreen() {
  const { colors } = useTheme();
  const recentlyAdded = albumListsStore((s) => s.recentlyAdded);
  const recentlyPlayed = albumListsStore((s) => s.recentlyPlayed);
  const frequentlyPlayed = albumListsStore((s) => s.frequentlyPlayed);
  const randomSelection = albumListsStore((s) => s.randomSelection);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AlbumSection
          listType="recentlyAdded"
          albums={recentlyAdded}
          colors={colors}
        />
        <AlbumSection
          listType="recentlyPlayed"
          albums={recentlyPlayed}
          colors={colors}
        />
        <AlbumSection
          listType="frequentlyPlayed"
          albums={frequentlyPlayed}
          colors={colors}
        />
        <AlbumSection
          listType="randomSelection"
          albums={randomSelection}
          colors={colors}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    padding: 4,
  },
  iconButtonPressed: {
    opacity: 0.6,
  },
  emptyText: {
    fontSize: 16,
  },
  horizontalList: {
    paddingRight: 16,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 12,
    padding: 8,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cover: {
    width: CARD_WIDTH - 16,
    height: CARD_WIDTH - 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  albumName: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  artistName: {
    fontSize: 13,
    marginTop: 2,
  },
});
