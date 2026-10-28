import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized, isAdminConfigured } from "@/lib/adminAuth";

/**
 * Protège la console d'administration (/admin, y compris ses actions serveur,
 * qui sont des POST sur la même adresse) — cf. lib/adminAuth.ts. Non
 * configurée : 404, comme si elle n'existait pas.
 */
export const config = { matcher: ["/admin", "/admin/:path*"] };

export function middleware(req: NextRequest) {
  if (!isAdminConfigured()) return new NextResponse("Not found", { status: 404 });
  if (!isAdminAuthorized(req.headers.get("authorization"))) {
    return new NextResponse("Authentification requise", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Horsetrack admin", charset="UTF-8"' },
    });
  }
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "no-store");
  return res;
}
