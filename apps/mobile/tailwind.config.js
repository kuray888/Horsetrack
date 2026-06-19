const { colors } = require("./src/theme/tokens.cjs");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ...colors,
        // alias kebab-case pour les classes (text-muted, text-on-primary…)
        muted: colors.textMuted,
        "on-primary": colors.textOnPrimary,
      },
      borderRadius: {
        card: "18px",
      },
      boxShadow: {
        // ombre de carte teintée navy
        card: "0px 4px 12px rgba(39, 76, 119, 0.08)",
      },
    },
  },
  plugins: [],
};
