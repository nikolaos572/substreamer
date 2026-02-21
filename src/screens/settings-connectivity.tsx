import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { offlineModeStore } from '../store/offlineModeStore';
import { removeTrustForHost } from '../services/sslTrustService';
import { sslCertStore, type TrustedCertEntry } from '../store/sslCertStore';

export function SettingsConnectivityScreen() {
  const { colors } = useTheme();

  const offlineMode = offlineModeStore((s) => s.offlineMode);
  const toggleOfflineMode = offlineModeStore((s) => s.toggleOfflineMode);
  const showInFilterBar = offlineModeStore((s) => s.showInFilterBar);
  const setShowInFilterBar = offlineModeStore((s) => s.setShowInFilterBar);

  const trustedCerts = sslCertStore((s) => s.trustedCerts);
  const trustedCertEntries = Object.entries(trustedCerts) as [string, TrustedCertEntry][];

  const handleRemoveTrustedCert = useCallback((hostname: string) => {
    Alert.alert(
      'Remove Trusted Certificate',
      `Remove the trusted certificate for ${hostname}? You will need to re-accept the certificate on next connection.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeTrustForHost(hostname).catch(() => {
              // Best-effort removal
            });
          },
        },
      ],
    );
  }, []);

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        container: { backgroundColor: colors.background },
        sectionTitle: { color: colors.label },
        card: { backgroundColor: colors.card },
        placeholder: { color: colors.textSecondary },
      }),
    [colors]
  );

  return (
    <ScrollView
      style={[styles.container, dynamicStyles.container]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>Offline mode</Text>
        <View style={[styles.card, dynamicStyles.card]}>
          <View style={[styles.toggleRow, { borderBottomColor: colors.border }]}>
            <View style={styles.toggleTextWrap}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                Offline Mode
              </Text>
              <Text style={[styles.toggleHint, { color: colors.textSecondary }]}>
                When enabled, only downloaded content is available. Searches are performed locally against cached content.
              </Text>
            </View>
            <Switch
              value={offlineMode}
              onValueChange={toggleOfflineMode}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
          <View style={[styles.toggleRow, styles.toggleRowLast]}>
            <View style={styles.toggleTextWrap}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                Show in Filter Bar
              </Text>
              <Text style={[styles.toggleHint, { color: colors.textSecondary }]}>
                Display the offline mode toggle in the filter bar for quick access.
              </Text>
            </View>
            <Switch
              value={showInFilterBar}
              onValueChange={setShowInFilterBar}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>Trusted certificates</Text>
        <View style={[styles.card, dynamicStyles.card]}>
          {trustedCertEntries.length > 0 ? (
            trustedCertEntries.map(([hostname, entry], index) => (
              <View
                key={hostname}
                style={[
                  styles.trustedCertRow,
                  index < trustedCertEntries.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <View style={styles.trustedCertInfo}>
                  <View style={styles.trustedCertHeader}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
                    <Text style={[styles.trustedCertHostname, { color: colors.textPrimary }]}>
                      {hostname}
                    </Text>
                  </View>
                  <Text style={[styles.trustedCertFingerprint, { color: colors.textSecondary }]} numberOfLines={1}>
                    {entry.sha256.substring(0, 23)}...
                  </Text>
                  <Text style={[styles.trustedCertDate, { color: colors.textSecondary }]}>
                    Trusted {new Date(entry.acceptedAt).toLocaleDateString()}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleRemoveTrustedCert(hostname)}
                  hitSlop={8}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <Ionicons name="close-circle-outline" size={22} color={colors.red} />
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={[styles.placeholder, dynamicStyles.placeholder]}>
              No trusted certificates. Self-signed certificates accepted during login will appear here.
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toggleRowLast: {
    borderBottomWidth: 0,
  },
  toggleTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  toggleHint: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  placeholder: {
    fontSize: 15,
    fontStyle: 'italic',
    padding: 16,
  },
  trustedCertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
  trustedCertInfo: {
    flex: 1,
  },
  trustedCertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  trustedCertHostname: {
    fontSize: 15,
    fontWeight: '600',
  },
  trustedCertFingerprint: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  trustedCertDate: {
    fontSize: 12,
  },
  pressed: {
    opacity: 0.8,
  },
});
