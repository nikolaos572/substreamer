import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AlbumRow } from '../components/AlbumRow';
import { ArtistRow } from '../components/ArtistRow';
import { SongRow } from '../components/SongRow';
import { useTheme } from '../hooks/useTheme';
import { playTrack } from '../services/playerService';
import { minDelay } from '../utils/stringHelpers';
import {
  type AlbumID3,
  type ArtistID3,
  type Child,
} from '../services/subsonicService';
import { searchStore } from '../store/searchStore';

/* ------------------------------------------------------------------ */
/*  Section data types                                                */
/* ------------------------------------------------------------------ */

type SectionItem =
  | { type: 'artist'; data: ArtistID3 }
  | { type: 'album'; data: AlbumID3 }
  | { type: 'song'; data: Child };

interface ResultSection {
  title: string;
  data: SectionItem[];
}

/* ------------------------------------------------------------------ */
/*  SearchScreen                                                      */
/* ------------------------------------------------------------------ */

export function SearchScreen() {
  const { colors } = useTheme();

  const query = searchStore((s) => s.query);
  const results = searchStore((s) => s.results);
  const loading = searchStore((s) => s.loading);
  const performSearch = searchStore((s) => s.performSearch);

  const hasResults =
    results.artists.length > 0 ||
    results.albums.length > 0 ||
    results.songs.length > 0;

  const sections: ResultSection[] = [];
  if (results.artists.length > 0) {
    sections.push({
      title: 'Artists',
      data: results.artists.map((a) => ({ type: 'artist' as const, data: a })),
    });
  }
  if (results.albums.length > 0) {
    sections.push({
      title: 'Albums',
      data: results.albums.map((a) => ({ type: 'album' as const, data: a })),
    });
  }
  if (results.songs.length > 0) {
    sections.push({
      title: 'Songs',
      data: results.songs.map((s) => ({ type: 'song' as const, data: s })),
    });
  }

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!query.trim()) return;
    setRefreshing(true);
    const delay = minDelay();
    await performSearch();
    await delay;
    setRefreshing(false);
  }, [query, performSearch]);

  const renderItem = useCallback(
    ({ item }: { item: SectionItem }) => {
      switch (item.type) {
        case 'artist':
          return <ArtistRow artist={item.data} />;
        case 'album':
          return <AlbumRow album={item.data} />;
        case 'song':
          return (
            <SongRow
              song={item.data}
              onPress={() => playTrack(item.data, results.songs)}
            />
          );
      }
    },
    [results.songs]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: ResultSection }) => (
      <Text style={[styles.sectionTitle, { color: colors.label }]}>
        {section.title}
      </Text>
    ),
    [colors.label]
  );

  const keyExtractor = useCallback(
    (item: SectionItem, index: number) => `${item.type}-${item.data.id}-${index}`,
    []
  );

  if (!query.trim() || (!hasResults && !loading)) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyContainer}>
          <Ionicons
            name="search-outline"
            size={56}
            color={colors.textSecondary}
            style={styles.emptyIcon}
          />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            {!query.trim()
              ? 'Search for music'
              : 'No results found'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {!query.trim()
              ? 'Find songs, albums, and artists'
              : `No results for "${query}"`}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
});
