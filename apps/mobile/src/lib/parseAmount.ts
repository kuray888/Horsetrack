/** Plus grand montant que les colonnes `Decimal(10,2)` du serveur acceptent :
 * au-delà, l'écriture est refusée en base et la ligne finissait par disparaître
 * de la file de synchronisation. */
export const MAX_AMOUNT = 99_999_999.99;

/**
 * Montant saisi à la main → nombre, ou null si la saisie n'est pas un montant
 * valide (vide, texte, négatif, trop grand). Accepte la virgule ou le point
 * comme séparateur décimal, et les séparateurs de milliers : « 45,50 »,
 * « 45.50 », « 1 234,50 », « 1.234,50 », « 1,234.50 ».
 */
export function parseAmount(input: string): number | null {
  const raw = input.replace(/[\s  €]/g, "");
  if (!/^\d[\d.,]*$/.test(raw)) return null;
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  const decimalAt = Math.max(lastComma, lastDot);
  let normalized: string;
  if (decimalAt === -1) {
    normalized = raw;
  } else {
    const other = lastComma > lastDot ? "." : ",";
    const sep = lastComma > lastDot ? "," : ".";
    const hasOther = raw.includes(other);
    const sameCount = raw.split(sep).length - 1;
    if (!hasOther && sameCount > 1) {
      // « 1.234.567 » : un seul type de séparateur répété = milliers.
      if (!new RegExp(`^\\d{1,3}(\\${sep}\\d{3})+$`).test(raw)) return null;
      normalized = raw.split(sep).join("");
    } else if (hasOther && (sameCount !== 1 || raw.lastIndexOf(other) > decimalAt)) {
      return null;
    } else {
      const integer = raw.slice(0, decimalAt).split(other).join("").split(sep).join("");
      normalized = `${integer}.${raw.slice(decimalAt + 1)}`;
    }
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Math.round(Number(normalized) * 100) / 100;
  return Number.isFinite(value) && value <= MAX_AMOUNT ? value : null;
}
