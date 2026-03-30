import { HeaderHeightContext } from '@react-navigation/elements';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useContext, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { GradientBackground } from '../components/GradientBackground';
import { SwipeableRow, type SwipeAction } from '../components/SwipeableRow';
import { useTheme } from '../hooks/useTheme';
import { albumInfoStore } from '../store/albumInfoStore';
import { artistDetailStore } from '../store/artistDetailStore';
import { mbidOverrideStore, type MbidOverride, type MbidOverrideType } from '../store/mbidOverrideStore';
import { mbidSearchStore } from '../store/mbidSearchStore';
import { offlineModeStore } from '../store/offlineModeStore';
import { processingOverlayStore } from '../store/processingOverlayStore';

const ROW_HEIGHT = 72;

/* ------------------------------------------------------------------ */
/*  Segment control                                                    */
/* ------------------------------------------------------------------ */

const SEGMENTS: { key: MbidOverrideType; label: string }[] = [
  { key: 'artist', label: 'Artists' },
  { key: 'album', label: 'Albums' },
];

const SegmentControl = memo(function SegmentControl({
  selected,
  onSelect,
  colors,
}: {
  selected: MbidOverrideType;
  onSelect: (type: MbidOverrideType) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={[styles.segmentContainer, { backgroundColor: colors.inputBg }]}>
      {SEGMENTS.map((seg) => {
        const isActive = seg.key === selected;
        return (
          <Pressable
            key={seg.key}
            onPress={() => onSelect(seg.key)}
            style={[
              styles.segment,
              isActive && [styles.segmentActive, { backgroundColor: colors.card }],
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: isActive ? colors.textPrimary : colors.textSecondary },
                isActive && styles.segmentTextActive,
              ]}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

/* ------------------------------------------------------------------ */
/*  Row                                                                */
/* ------------------------------------------------------------------ */

const OverrideRow = memo(function OverrideRow({
  override,
  offlineMode,
  colors,
}: {
  override: MbidOverride;
  offlineMode: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const handlePress = useCallback(() => {
    if (offlineMode) return;
    if (override.type === 'artist') {
      mbidSearchStore
        .getState()
        .showArtist(override.entityId, override.entityName, override.mbid);
    } else {
      mbidSearchStore
        .getState()
        .showAlbum(override.entityId, override.entityName, null, override.mbid);
    }
  }, [override, offlineMode]);

  const handleDelete = useCallback(async () => {
    const { type, entityId } = override;
    mbidOverrideStore.getState().removeOverride(type, entityId);
    if (type === 'artist' && entityId in artistDetailStore.getState().artists) {
      processingOverlayStore.getState().show('Updating Artist\u2026');
      try {
        await artistDetailStore.getState().fetchArtist(entityId);
        processingOverlayStore.getState().showSuccess('Artist Updated');
      } catch {
        processingOverlayStore.getState().showError('Failed to update artist');
      }
    } else if (type === 'album' && entityId in albumInfoStore.getState().entries) {
      processingOverlayStore.getState().show('Updating Album\u2026');
      try {
        await albumInfoStore.getState().fetchAlbumInfo(entityId);
        processingOverlayStore.getState().showSuccess('Album Updated');
      } catch {
        processingOverlayStore.getState().showError('Failed to update album');
      }
    }
  }, [override]);

  const rightActions: SwipeAction[] = useMemo(
    () => [
      {
        icon: 'trash-outline' as const,
        color: colors.red,
        label: 'Delete',
        onPress: handleDelete,
        removesRow: true,
      },
    ],
    [colors.red, handleDelete],
  );

  return (
    <View style={styles.rowWrapper}>
      <SwipeableRow
        rightActions={rightActions}
        enableFullSwipeRight
        onPress={handlePress}
        borderRadius={12}
      >
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={[styles.entityName, { color: colors.textPrimary }]} numberOfLines={1}>
              {override.entityName}
            </Text>
            <View style={styles.mbidRow}>
              <Ionicons name="finger-print-outline" size={14} color={colors.primary} />
              <Text style={[styles.mbid, { color: colors.textSecondary }]} numberOfLines={1}>
                {override.mbid}
              </Text>
            </View>
          </View>
        </View>
      </SwipeableRow>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/*  Screen                                                             */
/* ------------------------------------------------------------------ */

export function MbidOverrideBrowserScreen() {
  const { colors } = useTheme();
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const overrides = mbidOverrideStore((s) => s.overrides);
  const offlineMode = offlineModeStore((s) => s.offlineMode);
  const [selectedType, setSelectedType] = useState<MbidOverrideType>('artist');

  const allEntries = useMemo(() => Object.values(overrides), [overrides]);

  const data = useMemo(
    () =>
      allEntries
        .filter((o) => o.type === selectedType)
        .sort((a, b) => a.entityName.localeCompare(b.entityName)),
    [allEntries, selectedType],
  );

  const renderItem = useCallback(
    ({ item }: { item: MbidOverride }) => (
      <OverrideRow override={item} offlineMode={offlineMode} colors={colors} />
    ),
    [colors, offlineMode],
  );

  const keyExtractor = useCallback((item: MbidOverride) => `${item.type}:${item.entityId}`, []);

  return (
    <GradientBackground style={styles.container} scrollable>
      <FlashList
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={
          <View style={styles.segmentWrapper}>
            <SegmentControl selected={selectedType} onSelect={setSelectedType} colors={colors} />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="finger-print-outline"
            title={`No ${selectedType === 'artist' ? 'Artist' : 'Album'} Overrides`}
            subtitle={`Overrides for ${selectedType === 'artist' ? 'artists' : 'albums'} will appear here.`}
          />
        }
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: 32 }}
      />
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
  },
  segmentTextActive: {
    fontWeight: '600',
  },
  rowWrapper: {
    marginHorizontal: 16,
    marginBottom: 10,
  },
  row: {
    minHeight: ROW_HEIGHT,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
  },
  rowContent: {
    gap: 4,
  },
  entityName: {
    fontSize: 16,
    fontWeight: '600',
  },
  mbidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mbid: {
    fontSize: 12,
    fontFamily: 'monospace',
    flexShrink: 1,
  },
});
