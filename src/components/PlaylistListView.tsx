import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useCallback, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../hooks/useTheme';
import type { Playlist } from '../services/subsonicService';
import { PlaylistCard } from './PlaylistCard';
import { PlaylistRow } from './PlaylistRow';
import { AlphabetScroller } from './AlphabetScroller';

export type PlaylistLayout = 'list' | 'grid';

const GRID_COLUMNS = 2;
const GRID_GAP = 10;
const LIST_PADDING = 16;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getFirstLetter(name: string): string {
  const ch = name.charAt(0).toUpperCase();
  return /[A-Z]/.test(ch) ? ch : '#';
}

/* ------------------------------------------------------------------ */
/*  PlaylistListView                                                  */
/* ------------------------------------------------------------------ */

export interface PlaylistListViewProps {
  /** The list of playlists to display */
  playlists: Playlist[];
  /** Display layout: row list or grid of cards */
  layout?: PlaylistLayout;
  /** Whether data is currently loading */
  loading?: boolean;
  /** Error message to display, if any */
  error?: string | null;
  /** Called when the user pulls to refresh */
  onRefresh?: () => void;
  /** Whether a refresh is in progress (pull-to-refresh spinner) */
  refreshing?: boolean;
  /** Show the A-Z alphabet scroller on the right (list mode only) */
  showAlphabetScroller?: boolean;
}

export function PlaylistListView({
  playlists,
  layout = 'list',
  loading = false,
  error = null,
  onRefresh,
  refreshing = false,
  showAlphabetScroller = false,
}: PlaylistListViewProps) {
  const { colors } = useTheme();
  const listRef = useRef<FlashListRef<Playlist>>(null);

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = useMemo(
    () =>
      (screenWidth - LIST_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) /
      GRID_COLUMNS,
    [screenWidth]
  );

  const renderListItem = useCallback(
    ({ item }: { item: Playlist }) => <PlaylistRow playlist={item} />,
    []
  );

  const renderGridItem = useCallback(
    ({ item, index }: { item: Playlist; index: number }) => {
      const isLeftColumn = index % GRID_COLUMNS === 0;
      return (
        <View
          style={{
            flex: 1,
            paddingLeft: isLeftColumn ? 0 : GRID_GAP / 2,
            paddingRight: isLeftColumn ? GRID_GAP / 2 : 0,
          }}
        >
          <PlaylistCard playlist={item} width={cardWidth} />
        </View>
      );
    },
    [cardWidth]
  );

  const keyExtractor = useCallback((item: Playlist) => item.id, []);

  /* ---- Alphabet scroller support ---- */
  const isList = layout === 'list';
  const scrollerVisible = showAlphabetScroller && isList && playlists.length > 0;

  const activeLetters = useMemo(() => {
    if (!scrollerVisible) return new Set<string>();
    return new Set(playlists.map((p) => getFirstLetter(p.name)));
  }, [playlists, scrollerVisible]);

  const handleLetterChange = useCallback(
    (letter: string) => {
      const idx = playlists.findIndex((p) => {
        const first = getFirstLetter(p.name);
        if (letter === '#') return first === '#';
        return first === letter;
      });
      if (idx >= 0) {
        listRef.current?.scrollToIndex({ index: idx, animated: false });
      }
    },
    [playlists]
  );

  if (loading && playlists.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error && playlists.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          {error}
        </Text>
      </View>
    );
  }

  const isGrid = layout === 'grid';

  return (
    <View style={styles.wrapper}>
      <FlashList
        ref={listRef}
        key={layout}
        data={playlists}
        renderItem={isGrid ? renderGridItem : renderListItem}
        keyExtractor={keyExtractor}
        numColumns={isGrid ? GRID_COLUMNS : 1}
        contentContainerStyle={[
          styles.listContent,
          scrollerVisible && styles.listContentWithScroller,
        ]}
        drawDistance={300}
        onRefresh={onRefresh}
        refreshing={refreshing}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No playlists
          </Text>
        }
      />
      {scrollerVisible && (
        <AlphabetScroller
          activeLetters={activeLetters}
          onLetterChange={handleLetterChange}
        />
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: LIST_PADDING,
    paddingBottom: 32,
  },
  listContentWithScroller: {
    paddingRight: LIST_PADDING + 20,
  },
  errorText: {
    fontSize: 16,
  },
  emptyText: {
    fontSize: 16,
  },
});
