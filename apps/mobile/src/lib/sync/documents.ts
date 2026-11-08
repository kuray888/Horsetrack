import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { parseServerDate } from "@/lib/serverDate";
import type { Doc } from "@/agenda/store";
import { getOwnerProfile, settleWrite, signPaths } from "./shared";

/** Coffre-fort : documents et leurs fichiers.
 * Extrait de lib/cloudSync.ts (façade) sans changement de comportement. */

function categoryToDb(category: Doc["category"]): string {
  return category.toUpperCase();
}
function categoryFromDb(category: string): Doc["category"] {
  return category.toLowerCase() as Doc["category"];
}
/** Devine l'extension/le type MIME réels du fichier local plutôt que de
 * forcer ".jpg"/"image/jpeg" pour tout (cf. audit pré-publication) : un
 * document du coffre-fort peut être un PDF (cf. pickAndPersistDocument),
 * et un objet Storage uploadé avec un mauvais Content-Type ne s'affiche pas
 * correctement une fois resservi (signed URL). */
function documentContentType(localUri: string): { ext: string; contentType: string } {
  const ext = localUri.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return { ext: "pdf", contentType: "application/pdf" };
  if (ext === "png") return { ext: "png", contentType: "image/png" };
  return { ext: ext && /^[a-z0-9]{2,5}$/.test(ext) ? ext : "jpg", contentType: "image/jpeg" };
}
async function uploadDocumentPhoto(userId: string, docId: string, localUri: string): Promise<string | null> {
  try {
    const bytes = await new File(localUri).bytes();
    const { ext, contentType } = documentContentType(localUri);
    const path = `${userId}/${docId}.${ext}`;
    const { error } = await supabase.storage.from("documents").upload(path, bytes, {
      contentType,
      upsert: true,
    });
    return error ? null : path;
  } catch {
    return null;
  }
}
/** Upload la photo (si locale) puis upsert la ligne. Retourne le `filePath`
 * résultant — à reporter dans l'état local par l'appelant (cf. agenda/store.tsx
 * addDocument/updateDocument) pour ne pas re-uploader la même photo à chaque
 * synchro suivante. Retourne null sans rien casser si la synchro échoue (pas
 * de session, pas de profil serveur encore, erreur réseau).
 *
 * `doc.fileUri` ne vaut "file://…" QUE pour une photo locale pas encore
 * envoyée (une photo déjà synchronisée redevient une URL signée "https://…"
 * au prochain pull, cf. pullDocuments) : c'est un signal fiable de "photo à
 * (ré)uploader", qu'il s'agisse du tout premier envoi ou du remplacement
 * d'une photo existante lors d'une édition (cf. updateDocument) — le chemin
 * "{userId}/{docId}.jpg" est déterministe par document, un nouvel upload
 * écrase donc simplement l'ancien objet (upsert), même logique que les photos
 * de cheval (cf. uploadHorsePhoto plus haut). */
export async function pushDocumentImpl(doc: Doc, stamp?: number): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const profile = await getOwnerProfile(userId);
  if (!profile) return null;

  let filePath = doc.filePath;
  if (doc.fileUri?.startsWith("file://")) {
    const uploaded = await uploadDocumentPhoto(userId, doc.id, doc.fileUri);
    if (uploaded) {
      // Le chemin inclut l'extension réelle (documentContentType) — un
      // remplacement qui change de type de fichier (ex: jpg → pdf) upload donc
      // à un NOUVEAU chemin plutôt que d'écraser l'ancien objet (contrairement
      // au cas même-extension, cf. commentaire au-dessus de cette fonction).
      // Sans ce nettoyage, l'ancien objet restait orphelin dans Storage,
      // jamais référencé par aucune ligne `documents` et donc invisible/
      // impossible à supprimer depuis l'app.
      if (doc.filePath && doc.filePath !== uploaded) {
        await supabase.storage.from("documents").remove([doc.filePath]).catch(() => {});
      }
      filePath = uploaded;
    }
  }

  const row = {
    id: doc.id,
    riderId: profile.id,
    horseId: doc.horseId,
    category: categoryToDb(doc.category),
    name: doc.name,
    date: doc.date.toISOString(),
    filePath,
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase.from("documents").upsert(row);
  // Hors ligne : la ligne attend dans la file de reprise au lieu d'être
  // perdue (le fichier, lui, est renvoyé par retryPendingDocumentUploads).
  await settleWrite("pushDocument", "documents", doc.id, error, row, stamp);
  return error ? null : filePath;
}
/** `filePath` doit être le chemin Storage réel du document (cf. Doc.filePath,
 * rapporté par pullDocuments/pushDocument) — un document peut être un PDF ou
 * un PNG (cf. documentContentType), pas seulement un ".jpg" : reconstruire le
 * chemin en supposant ".jpg" ratait la suppression Storage pour tout autre
 * type de fichier, laissant l'objet orphelin indéfiniment (la ligne DB
 * disparaît, donc plus aucune référence ne permet de le retrouver ensuite). */
export async function deleteDocumentRemoteImpl(docId: string, filePath: string | null, stamp?: number): Promise<void> {
  const { error } = await supabase.from("documents").delete().eq("id", docId);
  await settleWrite("deleteDocumentRemote", "documents", docId, error, undefined, stamp);
  if (!filePath) return;
  // Best-effort : si l'objet Storage ne se supprime pas, RLS empêche de
  // toute façon tout accès par un autre utilisateur — pas une fuite.
  await supabase.storage.from("documents").remove([filePath]).catch(() => {});
}
/** Restaure le coffre-fort depuis Supabase (cf. (auth)/login.tsx, même
 * déclencheur que pullCloudData). Les URLs étant signées (bucket privé,
 * validité 7 jours), elles sont régénérées à chaque appel — donc à chaque
 * connexion sur un appareil qui n'a pas déjà les données locales.
 * Retourne `null` (jamais `[]`) sur tout échec réseau/auth/RLS — distingue
 * "on n'a pas pu vérifier" de "vraiment aucun document", pour que l'appelant
 * (login.tsx) n'écrase jamais l'état local existant avec un résultat qui ne
 * reflète pas la vraie donnée distante (cf. audit du 2026-09-09). */
export async function pullDocuments(): Promise<Doc[] | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const profile = await getOwnerProfile(userId);
  if (!profile) return null;

  const { data, error } = await supabase
    .from("documents")
    .select("id, horseId, category, name, date, filePath")
    .eq("riderId", profile.id);
  if (error || !data) return null;

  const docs: Doc[] = [];
  const signedFiles = await signPaths(
    "documents",
    data.map((row) => row.filePath).filter((p): p is string => !!p)
  );
  for (const row of data) {
    const fileUri = row.filePath ? (signedFiles.get(row.filePath) ?? null) : null;
    docs.push({
      id: row.id,
      horseId: row.horseId ?? null,
      category: categoryFromDb(row.category),
      name: row.name,
      date: parseServerDate(row.date),
      fileUri,
      filePath: row.filePath ?? null,
    });
  }
  return docs;
}

/**
 * Calendrier (rendez-vous + journal) : contrairement au coffre-fort, ces
 * tables sont scopées par horseId — pas par riderId — donc aucune jointure
 * via rider_profiles n'est nécessaire ici. La policy RLS `can_access_horse`
 * filtre déjà automatiquement aux chevaux possédés OU partagés avec
 * l'utilisateur courant (cf. partage demi-pension/coach), en lecture comme
 * en écriture : ces fonctions n'ont donc rien de spécial à faire pour gérer
 * le cas "cheval partagé", RLS s'en occupe.
 */
