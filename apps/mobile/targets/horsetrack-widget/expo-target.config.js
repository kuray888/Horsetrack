/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: "widget",
  displayName: "Horsetrack Widget",
  deploymentTarget: "17.0",
  frameworks: ["WidgetKit", "SwiftUI"],
  entitlements: {
    "com.apple.security.application-groups": ["group.com.horsetrack.app"],
  },
};
