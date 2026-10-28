import { t } from "@/i18n";

/**
 * Glossaire équestre — chaque terme marqué en **gras** dans le contenu d'un
 * programme (cf. program/rules.ts) doit avoir une entrée ici : c'est ce qui
 * permet d'afficher une définition au tap (cf. GlossaryProvider).
 */
export type GlossaryEntry = { term: string; definition: string };

const RAW_TERMS: GlossaryEntry[] = [
  { term: t("Rênes longues"), definition: t("Rênes relâchées et allongées qui laissent le cheval étirer librement son encolure vers l'avant et le bas — utilisé pour décontracter à l'échauffement ou en fin de séance.") },
  { term: t("Trot enlevé"), definition: t("Trot où le cavalier se soulève légèrement de la selle à chaque deuxième temps, en rythme avec la diagonale du cheval, pour soulager son dos sur de longues distances.") },
  { term: t("Trot assis"), definition: t("Trot où le cavalier reste assis en permanence sans se soulever — demande plus d'équilibre et de précision dans l'assiette.") },
  { term: t("Trot rassemblé"), definition: t("Trot raccourci où le cheval engage davantage ses postérieurs sous la masse et élève un peu plus ses membres — moins d'amplitude, plus d'équilibre.") },
  { term: t("Trot moyen"), definition: t("Trot avec plus d'amplitude et de poussée que le trot de travail, sans être au maximum (trot allongé).") },
  { term: t("Pas allongé"), definition: t("Pas où le cheval étire son encolure et allonge sa foulée au maximum tout en restant calme, pour détendre le dos.") },
  { term: t("Volte"), definition: t("Cercle de petit diamètre (généralement 10 à 20 m) tracé par le cheval, utilisé pour travailler la souplesse et l'incurvation.") },
  { term: t("Voltes"), definition: t("Cercles de petit diamètre (généralement 10 à 20 m) tracés par le cheval, utilisés pour travailler la souplesse et l'incurvation.") },
  { term: t("Diagonale"), definition: t("Au trot enlevé, le couple de membres sur lequel le cavalier se soulève — changer de diagonale répartit l'effort des deux côtés du dos du cheval.") },
  { term: t("Diagonales"), definition: t("Au trot enlevé, les couples de membres sur lesquels le cavalier se soulève — changer de diagonale répartit l'effort des deux côtés du dos du cheval. Désigne aussi les lignes droites tracées en diagonale dans la carrière.") },
  { term: t("Incurvation"), definition: t("Léger arrondi du corps du cheval, de la tête à la queue, dans le sens d'une courbe — signe qu'il suit la trajectoire avec souplesse plutôt que de la couper.") },
  { term: t("Épaule en dedans"), definition: t("Exercice de dressage où les épaules du cheval sont légèrement décalées vers l'intérieur de la piste par rapport à ses hanches, pour développer la souplesse latérale et l'engagement.") },
  { term: t("Appuyer"), definition: t("Déplacement latéral où le cheval avance en diagonale, croisant ses membres, tout en restant incurvé dans le sens du déplacement.") },
  { term: t("Cession à la jambe"), definition: t("Exercice latéral de base où le cheval se déplace sur le côté en répondant à la jambe, le corps resté droit, sans incurvation marquée.") },
  { term: t("Transitions"), definition: t("Changements d'allure (trot → galop, par exemple) ou de cadence au sein d'une même allure — une transition nette est précise, sans traîner ni se précipiter.") },
  { term: t("Transitions descendantes"), definition: t("Changements vers une allure plus lente (galop → trot, trot → pas) — une bonne transition descendante garde l'équilibre et la rectitude du cheval.") },
  { term: t("Rectitude"), definition: t("Le cheval avance avec ses postérieurs suivant exactement la trace de ses antérieurs, sans déviation du corps, en ligne droite comme sur une courbe.") },
  { term: t("Engagement"), definition: t("Capacité du cheval à amener ses postérieurs loin sous sa masse, ce qui développe sa puissance et son équilibre.") },
  { term: t("Assiette"), definition: t("Façon dont le cavalier se positionne et s'équilibre en selle — une bonne assiette accompagne les mouvements du cheval sans le déséquilibrer.") },
  { term: t("Foulée"), definition: t("Un cycle complet de mouvement des membres du cheval à une allure donnée — en saut d'obstacles, on compte le nombre de foulées entre deux obstacles d'une ligne.") },
  { term: t("Foulées"), definition: t("Cycles complets de mouvement des membres du cheval — en saut d'obstacles, on compte le nombre de foulées entre deux obstacles d'une ligne pour juger la distance.") },
  { term: t("Cavaletti"), definition: t("Petite barre surélevée de quelques centimètres, utilisée pour travailler la technique des membres sans la contrainte d'un véritable saut.") },
  { term: t("Cavalettis"), definition: t("Petites barres surélevées de quelques centimètres, utilisées pour travailler la technique des membres sans la contrainte d'un véritable saut.") },
  { term: t("Croisillons"), definition: t("Obstacles dont les barres sont disposées en croix, ce qui guide naturellement le cheval vers le centre de l'obstacle.") },
  { term: t("Abords"), definition: t("Phases d'approche d'un obstacle, juste avant le saut — un bon abord, c'est une approche dans un rythme et un équilibre adaptés.") },
  { term: t("Foulée d'appel"), definition: t("Dernière foulée avant le décollage, juste devant l'obstacle — son réglage (ni trop loin, ni trop près) conditionne la qualité du saut.") },
  { term: t("Longe"), definition: t("Corde longue fixée au licol ou au caveçon, qui permet de faire travailler le cheval en cercle autour du meneur, sans cavalier.") },
  { term: t("Caveçon"), definition: t("Pièce de matériel placée sur le chanfrein du cheval, souvent utilisée pour le travail à pied ou en longe sans solliciter la bouche.") },
  { term: t("Chambrière"), definition: "Longue tige flexible terminée par une mèche, utilisée à pied pour indiquer une direction ou stimuler le mouvement sans toucher le cheval." },
  { term: t("Désensibilisation"), definition: t("Travail progressif pour habituer le cheval à un objet, un bruit ou une situation qui pourrait l'inquiéter, afin qu'il reste calme.") },
  { term: t("Encolure basse"), definition: t("Position où le cheval porte sa tête et son encolure basses et étirées vers l'avant — signe de détente musculaire du dos.") },
  { term: t("Locomotion"), definition: t("Façon dont le cheval se déplace (régularité, amplitude, fluidité) — l'observer permet de repérer une éventuelle gêne ou boiterie.") },
  { term: t("Ostéopathe"), definition: t("Praticien spécialisé dans les manipulations douces des articulations et tissus, pour soulager des tensions ou blocages chez le cheval.") },
  { term: t("Arthrose"), definition: t("Usure progressive et irréversible du cartilage d'une articulation, qui peut provoquer raideur ou douleur, surtout après l'effort.") },
  { term: t("Fourbure"), definition: t("Inflammation douloureuse des tissus internes du pied (les lamelles), qui peut rendre la marche très difficile — nécessite une prise en charge vétérinaire stricte.") },
  { term: t("Tendinite"), definition: t("Inflammation d'un tendon, souvent due à une surcharge ou un faux mouvement, qui demande du repos et de la prudence à la reprise.") },
  { term: t("Chaleurs"), definition: t("Période du cycle hormonal de la jument pendant laquelle son comportement peut changer (plus sensible, plus nerveuse) — un phénomène naturel, pas un problème de dressage.") },
  { term: t("Guêtres"), definition: t("Protections souples ou rigides qui se fixent autour des membres du cheval pour le protéger des chocs pendant le travail.") },
  { term: t("Protège-boulets"), definition: t("Petites protections qui couvrent uniquement la zone du boulet (l'articulation juste au-dessus du paturon), utilisées surtout en extérieur ou à l'obstacle.") },
  { term: t("Cadence"), definition: t("Régularité du rythme d'une allure — une cadence stable signifie que le cheval garde la même vitesse de battue d'un pas/trot/galop à l'autre, sans accélérer ni ralentir.") },
  { term: t("Serpentine"), definition: t("Tracé en boucles successives traversant la carrière d'un côté à l'autre, utilisé pour travailler la souplesse et l'écoute aux changements de direction.") },
  { term: t("Huit de chiffre"), definition: t("Figure tracée en croisant deux cercles ou voltes pour former un 8, avec un changement de pli au point de croisement — exercice classique pour travailler la souplesse dans les deux sens.") },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[éèêë]/g, "e")
    .replace(/[àâ]/g, "a")
    .replace(/[ôö]/g, "o")
    .replace(/[ûùü]/g, "u")
    .replace(/[ïî]/g, "i")
    .replace(/ç/g, "c")
    .replace(/œ/g, "oe")
    .trim();
}

const GLOSSARY_BY_KEY = new Map<string, GlossaryEntry>(RAW_TERMS.map((entry) => [normalize(entry.term), entry]));

/** Cherche la définition d'un terme tappé dans le programme — comparaison
 * insensible à la casse et aux accents pour matcher peu importe la forme
 * utilisée dans la phrase (ex: "voltes" vs "Voltes" en début de phrase). */
export function lookupGlossaryTerm(term: string): GlossaryEntry | undefined {
  return GLOSSARY_BY_KEY.get(normalize(term));
}
