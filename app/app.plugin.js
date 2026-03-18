/**
 * Custom Expo config plugin to preserve Xcode project settings
 * This prevents manual changes (team ID, app icon, StoreKit config) from being lost during prebuild
 */

const { withXcodeProject } = require("@expo/config-plugins");

module.exports = function withPreservedXcodeSettings(config) {
  return withXcodeProject(config, async (config) => {
    const { modResults } = config;
    const project = modResults;

    // Preserve development team ID
    // Set via environment variable: EXPO_IOS_DEVELOPMENT_TEAM
    // Or update the default value below to match your team ID
    const teamId = process.env.EXPO_IOS_DEVELOPMENT_TEAM || "UHY6Q34C63";
    
    // Set development team for all build configurations
    // Also ensure dSYM generation is enabled for Release builds
    const configurations = project.pbxXCBuildConfigurationSection();
    Object.keys(configurations).forEach((configId) => {
      if (configId.includes("Debug") || configId.includes("Release")) {
        const buildSettings = configurations[configId].buildSettings;
        if (buildSettings && buildSettings.PRODUCT_BUNDLE_IDENTIFIER) {
          buildSettings.DEVELOPMENT_TEAM = teamId;
          
          // Enable dSYM generation for Release builds
          if (configId.includes("Release")) {
            buildSettings.DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
            buildSettings.GCC_GENERATE_DEBUGGING_SYMBOLS = "YES";
            buildSettings.COPY_PHASE_STRIP = "NO"; // Don't strip symbols
          }
        }
      }
    });

    return config;
  });
};
