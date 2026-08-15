import { db } from "@cheval/db";

/**
 * Plafond quotidien d'appels LLM par (utilisateur, fonctionnalité) — protège
 * le coût d'API par utilisateur (cf. modèle CoachUsage dans schema.prisma).
 * Partagé entre toutes les routes qui appellent OpenRouter (/api/coach,
 * /api/program-insight) pour ne pas dupliquer la logique d'incrément
 * atomique + rollback, dont la subtilité est facile à casser en la recopiant :
 * incrémenter D'ABORD, vérifier ENSUITE — un read-then-write (lire le
 * compteur, comparer, puis écrire seulement après l'appel LLM) laisse une
 * fenêtre de course où deux requêtes concurrentes lisent le même compteur
 * avant incrément et passent toutes les deux la limite. L'incrément Prisma se
 * traduit en `UPDATE ... SET count = count + 1`, atomique côté Postgres, donc
 * plus de fenêtre de course. En contrepartie, l'appelant DOIT appeler
 * `release()`, mais UNIQUEMENT dans les branches d'échec AVANT génération
 * (erreur réseau, timeout, rate-limit du provider...) où rien n'a été
 * facturé. Une réponse reçue mais inexploitable (contenu vide, JSON
 * invalide...) a déjà été facturée par le provider — ne JAMAIS appeler
 * `release()` dans ce cas, sous peine de laisser des appels réellement payés
 * hors du plafond quotidien (cf. audit sécurité, "frais cachés").
 */
export async function reserveDailyUsage(
  userId: string,
  feature: string,
  dailyLimit: number
): Promise<{ allowed: true; release: () => Promise<void> } | { allowed: false }> {
  const today = new Date().toISOString().slice(0, 10);

  const usage = await db.coachUsage.upsert({
    where: { userId_date_feature: { userId, date: today, feature } },
    update: { count: { increment: 1 } },
    create: { userId, date: today, feature, count: 1 },
  });

  const release = async () => {
    await db.coachUsage
      .update({ where: { userId_date_feature: { userId, date: today, feature } }, data: { count: { decrement: 1 } } })
      .catch(() => {});
  };

  if (usage.count > dailyLimit) {
    await release();
    return { allowed: false };
  }

  return { allowed: true, release };
}
