/**
 * AlbumInfoContent — shared album info panel used by both the phone player
 * and tablet expanded player views.
 *
 * Displays track metadata rows, album description with expand/collapse,
 * skeleton loading state, and external links (Last.fm, MusicBrainz, Wikipedia).
 */

import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getGenreNames } from '../utils/genreHelpers';
import { type Child } from '../services/subsonicService';

export interface AlbumInfoContentProps {
  track: Child;
  albumInfo: { notes?: string; lastFmUrl?: string; musicBrainzId?: string } | null;
  /** Release-group MBID from user override, or null. */
  overrideMbid: string | null;
  sanitizedNotes: string | null;
  notesAttributionUrl: string | null;
  albumInfoLoading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  colors: {
    textPrimary: string;
    textSecondary: string;
    primary: string;
    card: string;
    label: string;
    border: string;
  };
}

export const AlbumInfoContent = memo(function AlbumInfoContent({
  track,
  albumInfo,
  overrideMbid,
  sanitizedNotes,
  notesAttributionUrl,
  albumInfoLoading,
  refreshing,
  onRefresh,
  colors,
}: AlbumInfoContentProps) {
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [needsTruncation, setNeedsTruncation] = useState(false);

  // Reset expand/truncation state when notes change (different album)
  const notesRef = useRef(sanitizedNotes);
  if (notesRef.current !== sanitizedNotes) {
    notesRef.current = sanitizedNotes;
    if (notesExpanded) setNotesExpanded(false);
    if (needsTruncation) setNeedsTruncation(false);
  }

  // Build detail rows from track metadata
  const details = useMemo(() => {
    const rows: { label: string; value: string }[] = [];
    if (track.album) rows.push({ label: 'Album', value: track.album });
    if (track.artist) rows.push({ label: 'Artist', value: track.artist });
    if (track.displayAlbumArtist && track.displayAlbumArtist !== track.artist) {
      rows.push({ label: 'Album Artist', value: track.displayAlbumArtist });
    }
    if (track.displayComposer) rows.push({ label: 'Composer', value: track.displayComposer });
    if (track.year) rows.push({ label: 'Year', value: String(track.year) });
    const genreNames = getGenreNames(track);
    const genreText = genreNames.length > 0 ? genreNames.join(', ') : null;
    if (genreText) rows.push({ label: genreNames.length > 1 ? 'Genres' : 'Genre', value: genreText });
    if (track.bpm) rows.push({ label: 'BPM', value: String(track.bpm) });
    if (track.suffix && track.bitRate) {
      rows.push({ label: 'Format', value: `${track.suffix.toUpperCase()} · ${track.bitRate} kbps` });
    } else if (track.suffix) {
      rows.push({ label: 'Format', value: track.suffix.toUpperCase() });
    }
    if (track.playCount != null && track.playCount > 0) {
      rows.push({ label: 'Play Count', value: String(track.playCount) });
    }
    return rows;
  }, [track]);

  const handleLastFm = useCallback(() => {
    if (albumInfo?.lastFmUrl) Linking.openURL(albumInfo.lastFmUrl);
  }, [albumInfo?.lastFmUrl]);

  const handleMusicBrainz = useCallback(() => {
    if (overrideMbid) {
      // Override MBIDs are release-group IDs
      Linking.openURL(`https://musicbrainz.org/release-group/${overrideMbid}`);
    } else if (albumInfo?.musicBrainzId) {
      Linking.openURL(`https://musicbrainz.org/release/${albumInfo.musicBrainzId}`);
    }
  }, [overrideMbid, albumInfo?.musicBrainzId]);

  const handleWikipedia = useCallback(() => {
    if (notesAttributionUrl) Linking.openURL(notesAttributionUrl);
  }, [notesAttributionUrl]);

  return (
    <ScrollView
      style={styles.infoScrollView}
      contentContainerStyle={styles.infoContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {(albumInfoLoading || refreshing) ? (
        /* Skeleton placeholder */
        <View>
          {[0.4, 0.6, 0.5, 0.35, 0.55].map((w, i) => (
            <View key={i} style={styles.skeletonRow}>
              <View style={[styles.skeletonBar, styles.skeletonLabel]} />
              <View style={[styles.skeletonBar, { width: `${w * 100}%` }]} />
            </View>
          ))}
          <View style={styles.infoSection}>
            {[1, 0.97, 1, 0.95, 0.98, 1, 0.93, 0.96, 1, 0.6].map((w, i) => (
              <View
                key={i}
                style={[styles.skeletonBar, styles.skeletonTextLine, { width: `${w * 100}%` }]}
              />
            ))}
          </View>
          <View style={styles.skeletonLinksRow}>
            {[75, 95, 80].map((w, i) => (
              <View key={i} style={[styles.skeletonBar, styles.skeletonChip, { width: w }]} />
            ))}
          </View>
        </View>
      ) : (
        <>
          {/* Track & album details */}
          {details.map((row) => (
            <View key={row.label} style={[styles.infoDetailRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoDetailLabel, { color: colors.textSecondary }]}>{row.label}</Text>
              <Text style={[styles.infoDetailValue, { color: colors.textPrimary }]} numberOfLines={2}>
                {row.value}
              </Text>
            </View>
          ))}

          {/* Album description */}
          {sanitizedNotes ? (
            <View style={styles.infoSection}>
              <Text
                style={[styles.infoNotesText, { color: colors.textPrimary }]}
                numberOfLines={notesExpanded || !needsTruncation ? undefined : 12}
                onTextLayout={(e) => {
                  if (!needsTruncation && !notesExpanded && e.nativeEvent.lines.length > 15) {
                    setNeedsTruncation(true);
                  }
                }}
              >
                {sanitizedNotes}
              </Text>
              {needsTruncation && (
                <Pressable
                  onPress={() => setNotesExpanded((prev) => !prev)}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={[styles.infoReadMore, { color: colors.primary }]}>
                    {notesExpanded ? 'Show less' : 'Show more'}
                  </Text>
                </Pressable>
              )}
              {notesAttributionUrl && (
                <Pressable
                  onPress={handleWikipedia}
                  style={({ pressed }) => [styles.infoAttribution, pressed && styles.pressed]}
                  accessibilityRole="link"
                  accessibilityLabel="Source: Wikipedia"
                >
                  <Text style={[styles.infoAttributionText, { color: colors.textSecondary }]}>
                    Source: Wikipedia
                  </Text>
                  <Ionicons name="open-outline" size={11} color={colors.textSecondary} style={styles.infoLinkArrow} />
                </Pressable>
              )}
            </View>
          ) : null}
        </>
      )}

      {/* External links */}
      {(albumInfo?.lastFmUrl || overrideMbid || albumInfo?.musicBrainzId || notesAttributionUrl) && (
        <View style={styles.infoLinksRow}>
          {albumInfo?.lastFmUrl && (
            <Pressable
              onPress={handleLastFm}
              accessibilityRole="link"
              accessibilityLabel="View on Last.fm"
              style={({ pressed }) => [styles.infoLinkChip, pressed && styles.pressed]}
            >
              <Ionicons name="musical-notes" size={14} color={colors.textPrimary} />
              <Text style={[styles.infoLinkText, { color: colors.textPrimary }]}>Last.fm</Text>
              <Ionicons name="open-outline" size={12} color={colors.textPrimary} style={styles.infoLinkArrow} />
            </Pressable>
          )}
          {(overrideMbid || albumInfo?.musicBrainzId) && (
            <Pressable
              onPress={handleMusicBrainz}
              accessibilityRole="link"
              accessibilityLabel="View on MusicBrainz"
              style={({ pressed }) => [styles.infoLinkChip, pressed && styles.pressed]}
            >
              <Ionicons name="disc" size={14} color={colors.textPrimary} />
              <Text style={[styles.infoLinkText, { color: colors.textPrimary }]}>MusicBrainz</Text>
              <Ionicons name="open-outline" size={12} color={colors.textPrimary} style={styles.infoLinkArrow} />
            </Pressable>
          )}
          {notesAttributionUrl && (
            <Pressable
              onPress={handleWikipedia}
              accessibilityRole="link"
              accessibilityLabel="View on Wikipedia"
              style={({ pressed }) => [styles.infoLinkChip, pressed && styles.pressed]}
            >
              <Ionicons name="globe-outline" size={14} color={colors.textPrimary} />
              <Text style={[styles.infoLinkText, { color: colors.textPrimary }]}>Wikipedia</Text>
              <Ionicons name="open-outline" size={12} color={colors.textPrimary} style={styles.infoLinkArrow} />
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  infoScrollView: {
    flex: 1,
  },
  infoContent: {
    paddingTop: 20,
    paddingBottom: 24,
  },
  infoSection: {
    marginTop: 32,
  },
  infoDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoDetailLabel: {
    fontSize: 17,
    flex: 1,
  },
  infoDetailValue: {
    fontSize: 17,
    fontWeight: '500',
    marginLeft: 16,
    textAlign: 'right',
    flexShrink: 1,
  },
  infoNotesText: {
    fontSize: 17,
    lineHeight: 26,
  },
  infoReadMore: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  infoAttribution: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  infoAttributionText: {
    fontSize: 14,
    opacity: 0.6,
  },
  infoLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 32,
  },
  infoLinkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  infoLinkText: {
    fontSize: 15,
    fontWeight: '500',
  },
  infoLinkArrow: {
    opacity: 0.6,
  },

  /* Skeleton loading */
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  skeletonBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  skeletonLabel: {
    width: 70,
  },
  skeletonTextLine: {
    height: 14,
    marginBottom: 10,
  },
  skeletonLinksRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 32,
  },
  skeletonChip: {
    height: 28,
    borderRadius: 8,
  },

  pressed: {
    opacity: 0.6,
  },
});
