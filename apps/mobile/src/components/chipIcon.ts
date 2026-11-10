/**
 * Une puce reçoit soit un emoji (texte), soit un nom d'icône Material (texte
 * aussi, côté types), soit un objet { name, color }. Les écrans de la séance
 * en direct, de l'équipe et des tâches passaient « horse-variant » ou « walk » :
 * la puce l'affichait tel quel en toutes lettres au lieu de dessiner l'icône.
 * Cette fonction tranche d'après la table des glyphes de la police d'icônes.
 */
export function chipIconKind(icon: string, glyphs: Record<string, unknown>): "glyph" | "emoji" {
  return Object.prototype.hasOwnProperty.call(glyphs, icon) ? "glyph" : "emoji";
}
