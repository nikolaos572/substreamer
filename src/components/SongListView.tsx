import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../hooks/useTheme';
import type { Child } from '../services/subsonicService';
import { SongCard } from './SongCard';
import { SongRow, ROW_HEIGHT } from './SongRow';

export type SongLayout = 'list' | 'grid';

const GRID_COLUMNS = 2;
const GRID_GAP = 10;
const LIST_PADDING = 16;

/* ------------------------------------------------------------------ */
/*  SongListView                                                      */
/* ------------------------------------------------------------------ */

export interface SongListViewProps {
  /** The list of songs to display */
  songs: Child[];
  /** Display layout: row list or grid of cards */
  layout?: SongLayout;
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
}

export function SongListView({
  songs,
  layout = 'list',
  loading = false,
  error = null,
  onRefresh,
  refreshing = false,
  emptyMessage = 'No songs',
  emptyIcon,
}: SongListViewProps) {
  const { colors } = useTheme();

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = useMemo(
    () =>
      (screenWidth - LIST_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) /
      GRID_COLUMNS,
    [screenWidth]
  );

  const renderListItem = useCallback(
    ({ item }: { item: Child }) => <SongRow song={item} />,
    []
  );

  const renderGridItem = useCallback(
    ({ item }: { item: Child }) => (
      <SongCard song={item} width={cardWidth} />
    ),
    [cardWidth]
  );

  const keyExtractor = useCallback((item: Child) => item.id, []);

  const getItemLayout = useCallback(
    (_data: ArrayLike<Child> | null | undefined, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
      index,
    }),
    []
  );

  const columnWrapperStyle = useMemo(() => ({ gap: GRID_GAP }), []);

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

  if (loading && songs.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error && songs.length === 0) {
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
    <FlatList
      key={layout}
      data={songs}
      renderItem={isGrid ? renderGridItem : renderListItem}
      keyExtractor={keyExtractor}
      {...(isGrid
        ? { numColumns: GRID_COLUMNS, columnWrapperStyle }
        : { getItemLayout })}
      contentContainerStyle={[
        styles.listContent,
        songs.length === 0 && styles.emptyListContent,
      ]}
      windowSize={11}
      maxToRenderPerBatch={isGrid ? 12 : 20}
      initialNumToRender={isGrid ? 10 : 15}
      removeClippedSubviews
      onRefresh={onRefresh}
      refreshing={refreshing}
      ListEmptyComponent={EmptyComponent}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: LIST_PADDING,
    paddingBottom: 32,
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
