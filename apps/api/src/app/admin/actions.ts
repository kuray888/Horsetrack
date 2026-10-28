"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, Prisma } from "@cheval/db";
import { isAdminAuthorized } from "@/lib/adminAuth";
import { normalizePromoCode, parisDayBoundary, PROMO_CODE_PATTERN } from "@/lib/promoRules";

/** Revérifié ici en plus du middleware : une action serveur est un point
 * d'entrée à part entière. */
async function assertAdmin(): Promise<void> {
  const h = await headers();
  if (!isAdminAuthorized(h.get("authorization"))) throw new Error("Non autorisé");
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));
const optionalInt = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `entre ${min} et ${max}` });
        return z.NEVER;
      }
      return n;
    });

const createSchema = z
  .object({
    code: z.string().transform(normalizePromoCode).pipe(z.string().regex(PROMO_CODE_PATTERN, "3 à 32 lettres, chiffres ou tirets")),
    kind: z.enum(["PREMIUM_DAYS", "STORE_OFFER"]),
    description: optionalText(140),
    premiumDays: optionalInt(1, 366),
    storeOfferCode: optionalText(64).transform((v) => (v ? normalizePromoCode(v) : null)),
    discountType: z.enum(["", "PERCENT", "AMOUNT", "FREE_PERIOD"]).transform((v) => (v === "" ? null : v)),
    discountValue: optionalInt(1, 100000),
    startsAt: z.string(),
    expiresAt: z.string(),
    maxRedemptions: optionalInt(1, 1_000_000),
    eligibility: z.enum(["ANYONE", "NEVER_SUBSCRIBED", "LAPSED_SUBSCRIBERS"]),
    maxAccountAgeDays: optionalInt(1, 3650),
    campaign: optionalText(60),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "PREMIUM_DAYS" && v.premiumDays === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["premiumDays"], message: "durée requise" });
    }
    if (v.discountType === "PERCENT" && v.discountValue !== null && v.discountValue > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "100 % au plus" });
    }
  });

const FIELD_LABELS: Record<string, string> = {
  code: "Code",
  premiumDays: "Jours de Premium",
  discountValue: "Valeur de la remise",
  maxRedemptions: "Utilisations max",
  maxAccountAgeDays: "Ancienneté du compte",
  description: "Message",
  campaign: "Campagne",
};

function fail(message: string): never {
  redirect(`/admin?error=${encodeURIComponent(message)}#codes`);
}

export async function createPromoCode(formData: FormData): Promise<void> {
  await assertAdmin();
  const raw = Object.fromEntries(
    Object.keys(createSchema.innerType().shape).map((k) => [k, String(formData.get(k) ?? "")])
  );
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = FIELD_LABELS[String(issue.path[0])] ?? String(issue.path[0]);
    fail(`${field} : ${issue.message}`);
  }
  const v = parsed.data;
  const startsAt = v.startsAt ? parisDayBoundary(v.startsAt) : null;
  const expiresAt = v.expiresAt ? parisDayBoundary(v.expiresAt, true) : null;
  if ((v.startsAt && !startsAt) || (v.expiresAt && !expiresAt)) fail("Date invalide.");
  if (startsAt && expiresAt && expiresAt <= startsAt) fail("La fin doit être après le début.");

  const isStore = v.kind === "STORE_OFFER";
  try {
    await db.promoCode.create({
      data: {
        code: v.code,
        kind: v.kind,
        description: v.description,
        premiumDays: isStore ? 0 : (v.premiumDays ?? 0),
        storeOfferCode: isStore ? v.storeOfferCode : null,
        discountType: isStore ? v.discountType : null,
        discountValue: isStore && v.discountType ? v.discountValue : null,
        startsAt,
        expiresAt,
        maxRedemptions: v.maxRedemptions,
        eligibility: v.eligibility,
        maxAccountAgeDays: v.maxAccountAgeDays,
        campaign: v.campaign,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") fail(`Le code ${v.code} existe déjà.`);
    throw e;
  }
  revalidatePath("/admin");
  redirect(`/admin?ok=${encodeURIComponent(`Code ${v.code} créé.`)}#codes`);
}

export async function setPromoCodeActive(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) fail("Code introuvable.");
  const updated = await db.promoCode.update({ where: { id }, data: { active }, select: { code: true } });
  revalidatePath("/admin");
  redirect(`/admin?ok=${encodeURIComponent(`Code ${updated.code} ${active ? "réactivé" : "désactivé"}.`)}#codes`);
}

/** Signalement d'un commentaire du fil privé : supprimer le commentaire
 * (ses signalements partent avec lui) ou classer le signalement. */
export async function handleCommentReport(formData: FormData): Promise<void> {
  await assertAdmin();
  const commentId = String(formData.get("commentId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!commentId) fail("Commentaire introuvable.");
  if (decision === "delete") {
    await db.horseComment.deleteMany({ where: { id: commentId } });
  } else {
    await db.commentReport.updateMany({ where: { commentId, resolvedAt: null }, data: { resolvedAt: new Date() } });
  }
  revalidatePath("/admin");
  redirect(`/admin?ok=${encodeURIComponent(decision === "delete" ? "Commentaire supprimé." : "Signalement classé.")}#signalements`);
}
