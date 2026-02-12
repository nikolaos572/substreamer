const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Config plugin that silences the Xcode warning:
 *   "Run script build phase '[CP-User] [Hermes] Replace Hermes for the right
 *   configuration, if needed' will be run during every build because it does
 *   not specify any outputs."
 *
 * It patches the Podfile post_install block to set `always_out_of_date` on
 * the hermes-engine shell script phases so Xcode no longer warns.
 */
function withSilenceHermesWarning(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      let podfile = fs.readFileSync(podfilePath, "utf8");

      const snippet = `
    # Silence warning about Hermes script phase missing output dependencies
    installer.pods_project.targets.each do |target|
      if target.name == 'hermes-engine'
        target.build_phases.each do |phase|
          if phase.is_a?(Xcodeproj::Project::Object::PBXShellScriptBuildPhase)
            phase.always_out_of_date = "1"
          end
        end
      end
    end`;

      // Only patch if we haven't already
      if (!podfile.includes("always_out_of_date")) {
        // Insert the snippet right before the closing `end` of post_install
        podfile = podfile.replace(
          /^(\s*react_native_post_install\(.*?\))\s*\n(\s*end\s*\n\s*end)/ms,
          `$1\n${snippet}\n$2`
        );
        fs.writeFileSync(podfilePath, podfile, "utf8");
      }

      return config;
    },
  ]);
}

module.exports = withSilenceHermesWarning;
