import { Ionicons } from '@expo/vector-icons';
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
import type { ArtistID3 } from '../services/subsonicService';
import { ArtistCard } from './ArtistCard';
import { ArtistRow } from './ArtistRow';
import { AlphabetScroller } from './AlphabetScroller';

export type ArtistLayout = 'list' | 'grid';

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
/*  ArtistListView                                                    */
/* ------------------------------------------------------------------ */

export interface ArtistListViewProps {
  /** The list of artists to display */
  artists: ArtistID3[];
  /** Display layout: row list or grid of cards */
  layout?: ArtistLayout;
  /** Whether data is currently loading */
  loading?: boolean;
  /** Error message to display, if any */
  error?: string | null;
  /** Called when the user pulls to refresh */
  onRefresh?: () => void;
  /** Whether a refresh is in progress (pull-to-refresh spinner) */
  refreshing?: boolean;
  /** Custom empty-state message */
  emptyMessage?: string;
  /** Optional Ionicons icon name for empty state */
  emptyIcon?: string;
  /** Show the A-Z alphabet scroller on the right (list mode only) */
  showAlphabetScroller?: boolean;
}

export function ArtistListView({
  artists,
  layout = 'list',
  loading = false,
  error = null,
  onRefresh,
  refreshing = false,
  emptyMessage = 'No artists',
  emptyIcon,
  showAlphabetScroller = false,
}: ArtistListViewProps) {
  const { colors } = useTheme();
  const listRef = useRef<FlashListRef<ArtistID3>>(null);

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = useMemo(
    () =>
      (screenWidth - LIST_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) /
      GRID_COLUMNS,
    [screenWidth]
  );

  const renderListItem = useCallback(
    ({ item }: { item: ArtistID3 }) => <ArtistRow artist={item} />,
    []
  );

  const renderGridItem = useCallback(
    ({ item, index }: { item: ArtistID3; index: number }) => {
      const isLeftColumn = index % GRID_COLUMNS === 0;
      return (
        <View
          style={{
            flex: 1,
            paddingLeft: isLeftColumn ? 0 : GRID_GAP / 2,
            paddingRight: isLeftColumn ? GRID_GAP / 2 : 0,
          }}
        >
          <ArtistCard artist={item} width={cardWidth} />
        </View>
      );
    },
    [cardWidth]
  );

  const keyExtractor = useCallback((item: ArtistID3) => item.id, []);

  const EmptyComponent = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        {emptyIcon && (
          <Ionicons
            name={emptyIcon as any}
            size={48}
            color={colors.textSecondary}
            style={styles.emptyIcon}
          />
        )}
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {emptyMessage}
        </Text>
      </View>
    ),
    [emptyIcon, emptyMessage, colors.textSecondary]
  );

  /* ---- Alphabet scroller support ---- */
  const isList = layout === 'list';
  const scrollerVisible = showAlphabetScroller && isList && artists.length > 0;

  const activeLetters = useMemo(() => {
    if (!scrollerVisible) return new Set<string>();
    return new Set(artists.map((a) => getFirstLetter(a.name)));
  }, [artists, scrollerVisible]);

  const handleLetterChange = useCallback(
    (letter: string) => {
      const idx = artists.findIndex((a) => {
        const first = getFirstLetter(a.name);
        if (letter === '#') return first === '#';
        return first === letter;
      });
      if (idx >= 0) {
        listRef.current?.scrollToIndex({ index: idx, animated: false });
      }
    },
    [artists]
  );

  if (loading && artists.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error && artists.length === 0) {
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
        data={artists}
        renderItem={isGrid ? renderGridItem : renderListItem}
        keyExtractor={keyExtractor}
        numColumns={isGrid ? GRID_COLUMNS : 1}
        contentContainerStyle={[
          styles.listContent,
          scrollerVisible && styles.listContentWithScroller,
          artists.length === 0 && styles.emptyListContent,
        ]}
        drawDistance={300}
        onRefresh={onRefresh}
        refreshing={refreshing}
        ListEmptyComponent={EmptyComponent}
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
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
  },
});
