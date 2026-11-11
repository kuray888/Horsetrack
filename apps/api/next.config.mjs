/**
 * En-têtes de sécurité de l'API et de ses pages (/admin, /suivi, pages
 * légales). Pas de Content-Security-Policy ici : la console /admin et le
 * suivi de balade utilisent des styles en ligne et une carte intégrée, une
 * CSP mal réglée les casserait sans test visuel (cf. audit du 2026-11-11).
 *
 * Referrer-Policy « no-referrer » : le lien de suivi /suivi/<jeton> porte son
 * jeton dans l'adresse ; il ne doit jamais partir vers Plans ou Google Maps
 * quand un proche ouvre la position.
 *
 * @type {import('next').NextConfig}
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
