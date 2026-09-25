import type { SyncGuard } from "@/lib/remoteIndex";

/**
 * Fusion d'une relecture du serveur (`remote`) avec l'état local (`local`),
 * ligne par ligne, sans jamais perdre une saisie locale. Pure : les règles
 * sont entièrement testées dans mergeRemote.test.ts.
 *
 * Pour chaque ligne :
 * - locale PROTÉGÉE (en file de reprise, en cours d'envoi, ou écrite après le
 *   départ de la relecture) → la version locale reste, présente ou supprimée ;
 * - présente des deux côtés → version du serveur, en gardant les champs
 *   propres à l'appareil (`preserve`) ;
 * - seulement sur le serveur → ajoutée (créée ailleurs : autre appareil,
 *   demi-pension…), sauf si on vient de la supprimer ici ;
 * - seulement en local → retirée SI elle était connue du serveur (supprimée
 *   ailleurs) ; gardée sinon (jamais envoyée : on ne jette rien).
 *
 * Les objets inchangés gardent leur identité (pas de re-rendu inutile), et la
 * liste renvoyée est la liste locale elle-même quand rien ne change.
 */
export type MergeResult<T> = {
  items: T[];
  added: T[];
  updated: { before: T; after: T }[];
  removed: T[];
  changed: boolean;
};

export function mergeRemote<T extends { id: string }>(
  local: readonly T[],
  remote: readonly T[],
  guard: SyncGuard,
  preserve: (local: T, remote: T) => T = (_l, r) => r,
  equals: (a: T, b: T) => boolean = sameContent
): MergeResult<T> {
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  const localIds = new Set(local.map((l) => l.id));
  const items: T[] = [];
  const added: T[] = [];
  const updated: { before: T; after: T }[] = [];
  const removed: T[] = [];

  for (const item of local) {
    const fromServer = remoteById.get(item.id);
    if (guard.isProtected(item.id)) {
      items.push(item);
      continue;
    }
    if (!fromServer) {
      if (guard.isKnown(item.id)) removed.push(item);
      else items.push(item);
      continue;
    }
    const next = preserve(item, fromServer);
    if (equals(item, next)) {
      items.push(item);
    } else {
      items.push(next);
      updated.push({ before: item, after: next });
    }
  }

  for (const fromServer of remote) {
    if (localIds.has(fromServer.id)) continue;
    if (guard.isProtected(fromServer.id) || guard.isRecentlyDeleted(fromServer.id)) continue;
    items.push(fromServer);
    added.push(fromServer);
  }

  const changed = added.length > 0 || updated.length > 0 || removed.length > 0;
  return { items: changed ? items : (local as T[]), added, updated, removed, changed };
}

/** Égalité de contenu (dates comprises, via leur représentation JSON). */
export function sameContent<T>(a: T, b: T): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Une URL signée Supabase (`…?token=<JWT>`) expire-t-elle bientôt ? Sert à
 * garder l'URL locale d'une photo/d'un document tant qu'elle est valable
 * (sinon chaque relecture changerait l'URL et re-téléchargerait l'image), et
 * à la remplacer avant qu'elle n'expire (les données partagées n'étaient
 * relues qu'à la connexion : leurs URL finissaient par expirer).
 */
export function signedUrlExpiresSoon(url: string | null | undefined, withinMs = 7 * 24 * 60 * 60 * 1000, now = Date.now()): boolean {
  if (!url || !url.startsWith("http")) return false;
  const match = url.match(/[?&]token=([^&]+)/);
  if (!match) return true;
  try {
    const payload = match[1].split(".")[1];
    if (!payload) return true;
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "="))
    );
    return typeof json.exp !== "number" || json.exp * 1000 - now < withinMs;
  } catch {
    return true;
  }
}

/**
 * Choix de l'URL d'un fichier (photo, document) après relecture :
 * - fichier local (`file://`) et même fichier distant → on garde le local
 *   (fonctionne hors ligne, déjà affiché) ;
 * - même fichier distant et URL signée encore valable → on garde l'URL
 *   locale (pas de re-téléchargement) ;
 * - sinon → la nouvelle URL signée.
 */
export function pickFileUrl(
  localUrl: string | null,
  localPath: string | null,
  remoteUrl: string | null,
  remotePath: string | null
): string | null {
  if (localPath !== remotePath) return remoteUrl;
  if (localUrl?.startsWith("file://")) return localUrl;
  if (localUrl && !signedUrlExpiresSoon(localUrl)) return localUrl;
  return remoteUrl ?? localUrl;
}
