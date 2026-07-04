const { withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

/**
 * Injecte SWIFT_VERSION = 5.0 pour tous les pods DANS le post_install
 * existant généré par React Native — CocoaPods n'autorise qu'un seul
 * post_install depuis la version 1.13+.
 */
function withSwiftVersion(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");

      if (!fs.existsSync(podfilePath)) {
        return config;
      }

      let content = fs.readFileSync(podfilePath, "utf8");

      const swiftCode =
        "  # Force Swift 5 — évite les erreurs `weak let` de Swift 6 sur Xcode 17\n" +
        "  installer.pods_project.targets.each do |target|\n" +
        "    target.build_configurations.each do |cfg|\n" +
        "      cfg.build_settings['SWIFT_VERSION'] = '5.0'\n" +
        "    end\n" +
        "  end\n";

      // Injecte DANS le post_install existant, juste après la ligne d'ouverture
      content = content.replace(
        /^(post_install do \|installer\|)/m,
        "$1\n" + swiftCode
      );

      fs.writeFileSync(podfilePath, content);
      return config;
    },
  ]);
}

module.exports = withSwiftVersion;
