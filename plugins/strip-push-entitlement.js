const { withEntitlementsPlist } = require("expo/config-plugins");

/**
 * Config plugin that removes the aps-environment entitlement from iOS builds.
 *
 * Why this exists:
 *   expo-notifications is installed for local-only notifications (download
 *   progress alerts). However, @expo/prebuild-config auto-applies the
 *   expo-notifications config plugin for every installed Expo package via
 *   `withVersionedExpoSDKPlugins`. That plugin unconditionally injects the
 *   `aps-environment` entitlement, which requires the provisioning profile
 *   to include the Push Notifications capability — even though this app
 *   never uses remote/push notifications.
 *
 * What it does:
 *   Runs after the auto-applied expo-notifications plugin and deletes the
 *   `aps-environment` key from the iOS entitlements plist. This allows the
 *   build to succeed with a provisioning profile that lacks Push
 *   Notifications, while local notification APIs continue to work normally.
 *
 * Impact:
 *   - Remote/push notifications will NOT work (intentional).
 *   - Local notifications (scheduleNotificationAsync, etc.) are unaffected.
 *   - Safe to remove if expo-notifications is uninstalled or if a future
 *     Expo SDK stops auto-applying the entitlement.
 */
function withStripPushEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults["aps-environment"];
    return config;
  });
}

module.exports = withStripPushEntitlement;
