const { withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

/**
 * Force SWIFT_VERSION = 5.0 pour tous les pods.
 * Nécessaire avec Xcode 17 / iOS 26 : Swift 6 est devenu le défaut et
 * plusieurs packages tiers utilisent `weak let` qui est une erreur en Swift 6.
 *
 * Le bloc est toujours ajouté à la fin du Podfile (pas de check conditionnel)
 * pour s'assurer qu'il override tout réglage précédent.
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

      const patch =
        "\n# Force Swift 5 for all pods — avoids Swift 6 `weak let` errors on Xcode 17\n" +
        "post_install do |installer|\n" +
        "  installer.pods_project.targets.each do |target|\n" +
        "    target.build_configurations.each do |cfg|\n" +
        "      cfg.build_settings['SWIFT_VERSION'] = '5.0'\n" +
        "    end\n" +
        "  end\n" +
        "end\n";

      // Toujours ajouter à la fin — le dernier post_install gagne sur les précédents
      fs.writeFileSync(podfilePath, content + patch);

      return config;
    },
  ]);
}

module.exports = withSwiftVersion;
