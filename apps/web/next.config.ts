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
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
