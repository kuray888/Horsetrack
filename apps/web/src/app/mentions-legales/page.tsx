import type { Metadata } from "next";
import { CONTACT_EMAIL, HOST, LINKS, PUBLISHER, SITE_NAME } from "@/content/site";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Éditeur, hébergeur, propriété intellectuelle et données personnelles du site Horsetrack.",
  alternates: { canonical: "/mentions-legales" },
  openGraph: { url: "/mentions-legales", title: "Mentions légales · Horsetrack" },
};

const external = { target: "_blank", rel: "noopener noreferrer" } as const;

export default function LegalNoticePage() {
  return (
    <article className={`container ${styles.page}`}>
      <header className={styles.head}>
        <p className="sticker sticker--blue">Informations légales</p>
        <h1 className="h2">Mentions légales</h1>
        <p className={styles.updated}>Dernière mise à jour : 6 octobre 2026</p>
      </header>

      <section aria-labelledby="editeur">
        <h2 id="editeur">Éditeur du site</h2>
        <p>
          Le site {SITE_NAME} et l&apos;application du même nom sont édités par {PUBLISHER.name}, {PUBLISHER.status}
          .
        </p>
        <ul>
          <li>Adresse : {PUBLISHER.address}</li>
          <li>SIREN : {PUBLISHER.siren}</li>
          <li>SIRET : {PUBLISHER.siret}</li>
          <li>
            Contact : <a href={LINKS.email}>{CONTACT_EMAIL}</a>
          </li>
        </ul>
        <p>Direction de la publication : {PUBLISHER.name}.</p>
      </section>

      <section aria-labelledby="hebergeur">
        <h2 id="hebergeur">Hébergement</h2>
        <p>
          Le site est hébergé par {HOST.name}, {HOST.address} (
          <a href={HOST.website} {...external}>
            vercel.com<span className="sr-only"> (nouvel onglet)</span>
          </a>
          ).
        </p>
      </section>

      <section aria-labelledby="donnees">
        <h2 id="donnees">Données personnelles et cookies</h2>
        <p>
          Ce site est une simple vitrine : il ne dépose aucun cookie, n&apos;utilise aucun outil de mesure
          d&apos;audience ni de publicité, ne contient aucun formulaire et ne collecte aucune donnée personnelle. Aucun
          bandeau de consentement n&apos;est donc nécessaire.
        </p>
        <p>
          Comme tout hébergeur, {HOST.name} peut conserver des journaux techniques de connexion (adresse IP, date,
          page demandée) pendant une durée limitée, pour assurer la sécurité et le bon fonctionnement du service.
        </p>
        <p>
          Les données traitées par l&apos;application {SITE_NAME} sont décrites dans sa{" "}
          <a href={LINKS.privacy} {...external}>
            politique de confidentialité<span className="sr-only"> (nouvel onglet)</span>
          </a>
          . Pour exercer vos droits (accès, rectification, effacement, opposition), écrivez à{" "}
          <a href={LINKS.email}>{CONTACT_EMAIL}</a>. Vous pouvez aussi introduire une réclamation auprès de la CNIL (
          <a href="https://www.cnil.fr" {...external}>
            cnil.fr<span className="sr-only"> (nouvel onglet)</span>
          </a>
          ).
        </p>
      </section>

      <section aria-labelledby="propriete">
        <h2 id="propriete">Propriété intellectuelle</h2>
        <p>
          Les textes, le logo, les visuels et les captures d&apos;écran de l&apos;application présentés sur ce site
          sont la propriété de l&apos;éditeur. Toute reproduction, totale ou partielle, sans autorisation écrite
          préalable est interdite.
        </p>
        <p>
          Apple, le logo Apple, iPhone et App Store sont des marques d&apos;Apple Inc., déposées aux États-Unis et
          dans d&apos;autres pays. La police Bricolage Grotesque est distribuée sous licence SIL Open Font License.
        </p>
      </section>

      <section aria-labelledby="conditions">
        <h2 id="conditions">Conditions d&apos;utilisation de l&apos;application</h2>
        <p>
          L&apos;utilisation de l&apos;application est régie par ses{" "}
          <a href={LINKS.terms} {...external}>
            conditions générales d&apos;utilisation<span className="sr-only"> (nouvel onglet)</span>
          </a>
          . Pour toute question : <a href={LINKS.email}>{CONTACT_EMAIL}</a> ou la{" "}
          <a href={LINKS.support} {...external}>
            page d&apos;aide<span className="sr-only"> (nouvel onglet)</span>
          </a>
          .
        </p>
      </section>
    </article>
  );
}
