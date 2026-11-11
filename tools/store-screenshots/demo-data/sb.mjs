// Client minimal Supabase (REST) pour le compte de démonstration. Le mot de passe vient de l'environnement.
import { readFileSync } from "node:fs";
const eas = JSON.parse(readFileSync(new URL("../../../apps/mobile/eas.json", import.meta.url), "utf8")).build.simulator.env;
export const URL_ = eas.EXPO_PUBLIC_SUPABASE_URL, KEY = eas.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export async function login() {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "content-type": "application/json" }, body: JSON.stringify({ email: process.env.EMAIL, password: process.env.PASSWORD }) });
  const j = await r.json(); if (!j.access_token) throw new Error("login: " + JSON.stringify(j).slice(0, 200));
  return { token: j.access_token, userId: j.user.id };
}
export async function rest(token, method, path, body) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { method, headers: { apikey: KEY, authorization: `Bearer ${token}`, "content-type": "application/json", prefer: "return=representation" }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}
