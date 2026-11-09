import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * CSP du site vitrine : tout est servi depuis notre domaine (polices
 * auto-hébergées par next/font, images optimisées par /_next/image), aucun
 * script tiers, aucune mesure d'audience.
 *
 * `script-src 'unsafe-inline'` : Next.js injecte ses données d'hydratation
 * dans des <script> en ligne. Une CSP à nonce l'éviterait mais forcerait le
 * rendu de chaque page à la requête, alors que le site est 100 % statique et
 * n'affiche aucune donnée saisie par un visiteur (pas de formulaire, pas de
 * paramètre réinjecté) — compromis assumé, le reste de la politique reste
 * fermé (aucune origine externe, pas d'<object>, pas d'iframe).
 * `'unsafe-eval'` et `ws:` ne servent qu'au rechargement à chaud en dev.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "manifest-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/**
 * Espace gestionnaire (/gestion) : même politique, avec en plus la connexion
 * à Supabase (adresse du projet lue au build). Les autres pages gardent la
 * politique ci-dessus, fermée à toute origine externe.
 */
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : null;
const gestionCsp = csp.replace("connect-src 'self'", `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`);

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 128, 192, 256, 320, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    return [
      // Tout le site sauf /gestion : un en-tête CSP en double durcirait les deux.
      { source: "/((?!gestion).*)", headers: securityHeaders },
      {
        source: "/gestion/:path*",
        headers: [
          ...securityHeaders.filter((h) => h.key !== "Content-Security-Policy"),
          { key: "Content-Security-Policy", value: gestionCsp },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
