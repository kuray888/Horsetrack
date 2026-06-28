/**
 * Glossaire équestre — chaque terme marqué en **gras** dans le contenu d'un
 * programme (cf. program/rules.ts) doit avoir une entrée ici : c'est ce qui
 * permet d'afficher une définition au tap (cf. GlossaryProvider).
 */
export type GlossaryEntry = { term: string; definition: string };

const RAW_TERMS: GlossaryEntry[] = [
  { term: "Rênes longues", definition: "Rênes relâchées et allongées qui laissent le cheval étirer librement son encolure vers l'avant et le bas — utilisé pour décontracter à l'échauffement ou en fin de séance." },
  { term: "Trot enlevé", definition: "Trot où le cavalier se soulève légèrement de la selle à chaque deuxième temps, en rythme avec la diagonale du cheval, pour soulager son dos sur de longues distances." },
  { term: "Trot assis", definition: "Trot où le cavalier reste assis en permanence sans se soulever — demande plus d'équilibre et de précision dans l'assiette." },
  { term: "Trot rassemblé", definition: "Trot raccourci où le cheval engage davantage ses postérieurs sous la masse et élève un peu plus ses membres — moins d'amplitude, plus d'équilibre." },
  { term: "Trot moyen", definition: "Trot avec plus d'amplitude et de poussée que le trot de travail, sans être au maximum (trot allongé)." },
  { term: "Pas allongé", definition: "Pas où le cheval étire son encolure et allonge sa foulée au maximum tout en restant calme, pour détendre le dos." },
  { term: "Volte", definition: "Cercle de petit diamètre (généralement 10 à 20 m) tracé par le cheval, utilisé pour travailler la souplesse et l'incurvation." },
  { term: "Voltes", definition: "Cercles de petit diamètre (généralement 10 à 20 m) tracés par le cheval, utilisés pour travailler la souplesse et l'incurvation." },
  { term: "Diagonale", definition: "Au trot enlevé, le couple de membres sur lequel le cavalier se soulève — changer de diagonale répartit l'effort des deux côtés du dos du cheval." },
  { term: "Diagonales", definition: "Au trot enlevé, les couples de membres sur lesquels le cavalier se soulève — changer de diagonale répartit l'effort des deux côtés du dos du cheval. Désigne aussi les lignes droites tracées en diagonale dans la carrière." },
  { term: "Incurvation", definition: "Léger arrondi du corps du cheval, de la tête à la queue, dans le sens d'une courbe — signe qu'il suit la trajectoire avec souplesse plutôt que de la couper." },
  { term: "Épaule en dedans", definition: "Exercice de dressage où les épaules du cheval sont légèrement décalées vers l'intérieur de la piste par rapport à ses hanches, pour développer la souplesse latérale et l'engagement." },
  { term: "Appuyer", definition: "Déplacement latéral où le cheval avance en diagonale, croisant ses membres, tout en restant incurvé dans le sens du déplacement." },
  { term: "Cession à la jambe", definition: "Exercice latéral de base où le cheval se déplace sur le côté en répondant à la jambe, le corps resté droit, sans incurvation marquée." },
  { term: "Transitions", definition: "Changements d'allure (trot → galop, par exemple) ou de cadence au sein d'une même allure — une transition nette est précise, sans traîner ni se précipiter." },
  { term: "Transitions descendantes", definition: "Changements vers une allure plus lente (galop → trot, trot → pas) — une bonne transition descendante garde l'équilibre et la rectitude du cheval." },
  { term: "Rectitude", definition: "Le cheval avance avec ses postérieurs suivant exactement la trace de ses antérieurs, sans déviation du corps, en ligne droite comme sur une courbe." },
  { term: "Engagement", definition: "Capacité du cheval à amener ses postérieurs loin sous sa masse, ce qui développe sa puissance et son équilibre." },
  { term: "Assiette", definition: "Façon dont le cavalier se positionne et s'équilibre en selle — une bonne assiette accompagne les mouvements du cheval sans le déséquilibrer." },
  { term: "Foulée", definition: "Un cycle complet de mouvement des membres du cheval à une allure donnée — en saut d'obstacles, on compte le nombre de foulées entre deux obstacles d'une ligne." },
  { term: "Foulées", definition: "Cycles complets de mouvement des membres du cheval — en saut d'obstacles, on compte le nombre de foulées entre deux obstacles d'une ligne pour juger la distance." },
  { term: "Cavaletti", definition: "Petite barre surélevée de quelques centimètres, utilisée pour travailler la technique des membres sans la contrainte d'un véritable saut." },
  { term: "Cavalettis", definition: "Petites barres surélevées de quelques centimètres, utilisées pour travailler la technique des membres sans la contrainte d'un véritable saut." },
  { term: "Croisillons", definition: "Obstacles dont les barres sont disposées en croix, ce qui guide naturellement le cheval vers le centre de l'obstacle." },
  { term: "Abords", definition: "Phases d'approche d'un obstacle, juste avant le saut — un bon abord, c'est une approche dans un rythme et un équilibre adaptés." },
  { term: "Foulée d'appel", definition: "Dernière foulée avant le décollage, juste devant l'obstacle — son réglage (ni trop loin, ni trop près) conditionne la qualité du saut." },
  { term: "Longe", definition: "Corde longue fixée au licol ou au caveçon, qui permet de faire travailler le cheval en cercle autour du meneur, sans cavalier." },
  { term: "Caveçon", definition: "Pièce de matériel placée sur le chanfrein du cheval, souvent utilisée pour le travail à pied ou en longe sans solliciter la bouche." },
  { term: "Chambrière", definition: "Longue tige flexible terminée par une mèche, utilisée à pied pour indiquer une direction ou stimuler le mouvement sans toucher le cheval." },
  { term: "Désensibilisation", definition: "Travail progressif pour habituer le cheval à un objet, un bruit ou une situation qui pourrait l'inquiéter, afin qu'il reste calme." },
  { term: "Encolure basse", definition: "Position où le cheval porte sa tête et son encolure basses et étirées vers l'avant — signe de détente musculaire du dos." },
  { term: "Locomotion", definition: "Façon dont le cheval se déplace (régularité, amplitude, fluidité) — l'observer permet de repérer une éventuelle gêne ou boiterie." },
  { term: "Ostéopathe", definition: "Praticien spécialisé dans les manipulations douces des articulations et tissus, pour soulager des tensions ou blocages chez le cheval." },
  { term: "Arthrose", definition: "Usure progressive et irréversible du cartilage d'une articulation, qui peut provoquer raideur ou douleur, surtout après l'effort." },
  { term: "Fourbure", definition: "Inflammation douloureuse des tissus internes du pied (les lamelles), qui peut rendre la marche très difficile — nécessite une prise en charge vétérinaire stricte." },
  { term: "Tendinite", definition: "Inflammation d'un tendon, souvent due à une surcharge ou un faux mouvement, qui demande du repos et de la prudence à la reprise." },
  { term: "Chaleurs", definition: "Période du cycle hormonal de la jument pendant laquelle son comportement peut changer (plus sensible, plus nerveuse) — un phénomène naturel, pas un problème de dressage." },
  { term: "Guêtres", definition: "Protections souples ou rigides qui se fixent autour des membres du cheval pour le protéger des chocs pendant le travail." },
  { term: "Protège-boulets", definition: "Petites protections qui couvrent uniquement la zone du boulet (l'articulation juste au-dessus du paturon), utilisées surtout en extérieur ou à l'obstacle." },
  { term: "Cadence", definition: "Régularité du rythme d'une allure — une cadence stable signifie que le cheval garde la même vitesse de battue d'un pas/trot/galop à l'autre, sans accélérer ni ralentir." },
  { term: "Serpentine", definition: "Tracé en boucles successives traversant la carrière d'un côté à l'autre, utilisé pour travailler la souplesse et l'écoute aux changements de direction." },
  { term: "Huit de chiffre", definition: "Figure tracée en croisant deux cercles ou voltes pour former un 8, avec un changement de pli au point de croisement — exercice classique pour travailler la souplesse dans les deux sens." },
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
