/** Données structurées schema.org. `<` est échappé pour qu'aucune valeur ne
 * puisse refermer la balise <script> (injection HTML), même si un texte venait
 * un jour d'une source externe. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
