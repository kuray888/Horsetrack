import { NextRequest, NextResponse } from "next/server";

/**
 * Lien de téléchargement unique de l'app (emails d'invitation, textes partagés
 * depuis l'app, cf. apps/mobile/src/lib/links.ts) : redirige vers la fiche
 * Google Play sur Android, vers l'App Store ailleurs.
 *
 * Les adresses des fiches viennent de l'environnement (`APP_STORE_URL`,
 * `PLAY_STORE_URL`) : elles peuvent changer (lien court de campagne, page
 * produit personnalisée) sans republier l'app. Tant qu'elles ne sont pas
 * renseignées, une page simple explique où trouver l'app plutôt qu'une 404.
 */
export function GET(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  const isAndroid = /android/i.test(ua);
  const appStore = process.env.APP_STORE_URL;
  const playStore = process.env.PLAY_STORE_URL;

  const target = isAndroid ? (playStore ?? appStore) : (appStore ?? playStore);
  if (target) return NextResponse.redirect(target, 302);

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Télécharger Horsetrack</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #F6F4F0; color: #1d2a3a; margin: 0; padding: 48px 24px; text-align: center; }
  h1 { font-size: 28px; margin: 0 0 12px; }
  p { font-size: 17px; line-height: 1.5; max-width: 420px; margin: 0 auto 8px; }
</style>
</head>
<body>
  <h1>Horsetrack</h1>
  <p>Toi et ton cheval, organisés : planning, santé, concours et budget au même endroit.</p>
  <p>Recherche <strong>« Horsetrack »</strong> dans l'App Store${isAndroid ? " ou sur Google Play" : ""} pour l'installer.</p>
</body>
</html>`;
  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
