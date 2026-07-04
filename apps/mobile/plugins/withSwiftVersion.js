const { withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

/**
 * Force SWIFT_VERSION = 5.0 pour tous les pods.
 * Nécessaire avec Xcode 17 / iOS 26 : Swift 6 est devenu le défaut et
 * plusieurs packages tiers utilisent `weak let` qui est une erreur en Swift 6.
 */
function withSwiftVersion(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");
      let content = fs.readFileSync(podfilePath, "utf8");

      if (!content.includes("SWIFT_VERSION")) {
        content +=
          "\npost_install do |installer|\n" +
          "  installer.pods_project.targets.each do |target|\n" +
          "    target.build_configurations.each do |cfg|\n" +
          "      cfg.build_settings['SWIFT_VERSION'] = '5.0'\n" +
          "    end\n" +
          "  end\n" +
          "end\n";
        fs.writeFileSync(podfilePath, content);
      }

      return config;
    },
  ]);
}

module.exports = withSwiftVersion;
