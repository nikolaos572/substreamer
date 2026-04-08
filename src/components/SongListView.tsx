import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSharedValue } from 'react-native-reanimated';

import { useGridColumns, getGridItemPadding, GRID_GAP, LIST_PADDING } from '../hooks/useGridColumns';
import { useRefreshControlKey } from '../hooks/useRefreshControlKey';
import { useTheme } from '../hooks/useTheme';
import { EmptyState } from './EmptyState';
import { InsetRefreshSpacer } from './InsetRefreshSpacer';
import { playTrack } from '../services/playerService';
import type { Child } from '../services/subsonicService';
import { SongCard } from './SongCard';
import { SongRow } from './SongRow';
import { closeOpenRow } from './SwipeableRow';

export type SongLayout = 'list' | 'grid';

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
  /** Custom empty-state subtitle */
  emptySubtitle?: string;
  /** Optional Ionicons icon name for empty state */
  emptyIcon?: string;
  /** When this value changes, the list scrolls to the top */
  scrollToTopTrigger?: string;
  /** Extra top padding so content starts below a floating header but scrolls behind it */
  contentInsetTop?: number;
  /** Extra content rendered after the inset spacer in the list header */
  listHeaderExtra?: ReactNode;
}

export function SongListView({
  songs,
  layout = 'list',
  loading = false,
  error = null,
  onRefresh,
  refreshing = false,
  emptyMessage,
  emptySubtitle,
  emptyIcon,
  scrollToTopTrigger,
  contentInsetTop = 0,
  listHeaderExtra,
}: SongListViewProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const resolvedEmptyMessage = emptyMessage ?? t('noSongsFound');
  const resolvedEmptySubtitle = emptySubtitle ?? t('tryAdjustingFilters');
  const gridColumns = useGridColumns();
  const scrollY = useSharedValue(0);
  const refreshControlKey = useRefreshControlKey();

  const handleScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );

  const listKey = scrollToTopTrigger ? `${layout}:${scrollToTopTrigger}` : layout;

  const renderListItem = useCallback(
    ({ item }: { item: Child }) => (
      <SongRow song={item} onPress={() => playTrack(item, songs)} />
    ),
    [songs]
  );

  const renderGridItem = useCallback(
    ({ item, index }: { item: Child; index: number }) => {
      const { paddingLeft, paddingRight } = getGridItemPadding(index, gridColumns, GRID_GAP);
      return (
        <View
          style={{
            flex: 1,
            paddingLeft,
            paddingRight,
            marginBottom: GRID_GAP,
          }}
        >
          <SongCard song={item} onPress={() => playTrack(item, songs)} />
        </View>
      );
    },
    [songs, gridColumns]
  );

  const keyExtractor = useCallback((item: Child) => item.id, []);

  const EmptyComponent = useMemo(
    () => (
      <EmptyState
        icon={(emptyIcon as any) ?? 'musical-notes-outline'}
        title={resolvedEmptyMessage}
        subtitle={resolvedEmptySubtitle}
      />
    ),
    [emptyIcon, resolvedEmptyMessage, resolvedEmptySubtitle]
  );

  if (loading && songs.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error && songs.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          {error}
        </Text>
      </View>
    );
  }

  const isGrid = layout === 'grid';

  return (
    <FlashList
      key={listKey}
      data={songs}
      renderItem={isGrid ? renderGridItem : renderListItem}
      keyExtractor={keyExtractor}
      onScrollBeginDrag={closeOpenRow}
      numColumns={isGrid ? gridColumns : 1}
      contentContainerStyle={[
        styles.listContent,
        songs.length === 0 && styles.emptyListContent,
      ]}
      onScroll={contentInsetTop > 0 && Platform.OS === 'ios' ? handleScroll : undefined}
      scrollEventThrottle={contentInsetTop > 0 && Platform.OS === 'ios' ? 16 : undefined}
      ListHeaderComponent={
        contentInsetTop > 0 || listHeaderExtra ? (
          <>
            {contentInsetTop > 0 && (
              Platform.OS === 'ios' ? (
                <InsetRefreshSpacer
                  height={contentInsetTop}
                  refreshing={refreshing}
                  scrollY={scrollY}
                  color={colors.primary}
                />
              ) : (
                <View style={{ height: contentInsetTop }} />
              )
            )}
            {listHeaderExtra}
          </>
        ) : undefined
      }
      refreshControl={
        onRefresh ? (
          <RefreshControl
            key={refreshControlKey}
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={contentInsetTop > 0 ? 'transparent' : colors.primary}
            colors={[colors.primary]}
            progressViewOffset={contentInsetTop}
          />
        ) : undefined
      }
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
});
