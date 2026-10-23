import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";


export const Route = createFileRoute("/confidentialite")({
  head: () => ({ meta: [{ title: "Politique de confidentialité — DietFitPro" }] }),
  component: ConfidentialitePage,
});


function ConfidentialitePage() {
  return (
    <LegalLayout title="Politique de confidentialité" updatedAt="14 octobre 2026">
      <LegalSection title="1. Responsable du traitement">
        <p>
          Le responsable du traitement de vos données personnelles est David Rebot, entrepreneur
          individuel, SIRET 789 355 013 00010, Paris, France. Contact : dietfitpro26@gmail.com.
        </p>
      </LegalSection>

      <LegalSection title="2. Données que nous collectons">
        <ul className="list-disc space-y-1 pl-5">
          <li>Identité et compte : nom, adresse e-mail, mot de passe (stocké de façon chiffrée).</li>
          <li>
            Données de santé et de suivi : âge, sexe, poids, taille, objectif, niveau d'activité,
            grossesse ou allaitement (facultatif), historique de poids, journal alimentaire,
            programmes choisis.
          </li>
          <li>
            Abonnement et paiement : formule, statut de l'abonnement, dates, identifiants
            techniques Stripe, historique des achats. Vos données bancaires ne sont jamais
            conservées par DietFitPro.
          </li>
          <li>Communication : notifications et e-mails liés à votre compte et à vos paiements.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Pourquoi nous utilisons vos données">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Créer et gérer votre compte, et vous fournir le service (base légale : exécution du
            contrat).
          </li>
          <li>
            Calculer vos besoins et personnaliser vos programmes à partir de vos données de
            santé (base légale : votre consentement explicite).
          </li>
          <li>
            Gérer les abonnements, paiements, factures et litiges (exécution du contrat et
            obligations légales).
          </li>
          <li>Vous envoyer les e-mails indispensables au service, comme un paiement refusé.</li>
          <li>Assurer la sécurité du service et prévenir la fraude (intérêt légitime).</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Consentement pour les données de santé">
        <p>
          Les données concernant la santé sont des données sensibles. Nous ne les utilisons que
          si vous y consentez expressément, lors de votre inscription, par une case à cocher
          distincte. Vous pouvez retirer votre consentement à tout moment en supprimant votre
          compte depuis votre profil, ou en nous écrivant. Le retrait rend certains services
          indisponibles, puisqu'ils reposent sur ces données.
        </p>
      </LegalSection>

      <LegalSection title="5. Qui reçoit vos données">
        <p>
          Vos données ne sont jamais vendues. Elles sont accessibles à l'éditeur et à des
          prestataires techniques qui les traitent pour notre compte :
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase : base de données et authentification, serveurs en Allemagne (UE).</li>
          <li>Stripe : paiement en ligne sécurisé.</li>
          <li>Resend : envoi des e-mails liés à votre compte.</li>
          <li>Cloudflare : hébergement et acheminement de l'application.</li>
        </ul>
        <p>
          Certains de ces prestataires peuvent traiter des données en dehors de l'Union
          européenne, avec des garanties appropriées prévues par le RGPD (par exemple les
          clauses contractuelles types). [À VÉRIFIER AU MOMENT DE LA MISE EN LIGNE]
        </p>
      </LegalSection>

      <LegalSection title="6. Combien de temps nous les conservons">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Données de compte et de santé : tant que votre compte est actif. Elles sont
            supprimées définitivement lorsque vous supprimez votre compte.
          </li>
          <li>
            Justificatifs de paiement : conservés pendant la durée légale applicable aux pièces
            comptables. [À VÉRIFIER : durée exacte]
          </li>
          <li>
            Abonnement suspendu pour impayé : vos données sont conservées le temps de la
            régularisation.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Vos droits">
        <p>
          Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, de
          portabilité et d'opposition, ainsi que du droit de retirer votre consentement à tout
          moment. Vous pouvez supprimer votre compte vous-même depuis votre profil, ce qui
          efface vos données. Pour tout autre droit, écrivez à dietfitpro26@gmail.com ; nous
          répondons dans un délai d'un mois.
        </p>
        <p>
        </p>
      </LegalSection>

      <LegalSection title="8. Cookies et traceurs">
        <p>
          L'application utilise uniquement des éléments techniques nécessaires à son
          fonctionnement, comme le maintien de votre session de connexion. Aucun cookie
          publicitaire ni outil de suivi de votre navigation n'est utilisé. [À VÉRIFIER AU
          MOMENT DE LA MISE EN LIGNE]
        </p>
      </LegalSection>

      <LegalSection title="9. Sécurité">
        <p>
          Nous protégeons vos données par des mesures techniques adaptées : connexion chiffrée,
          authentification, contrôle d'accès à chaque donnée. Aucun système n'étant infaillible,
          nous vous informons, ainsi que la CNIL si la loi l'exige, en cas de violation de
          données vous concernant.
        </p>
      </LegalSection>

      <LegalSection title="10. Personnes mineures">
        <p>
          Les personnes de moins de 18 ans utilisent le service avec l'accord de leur
          représentant légal.
        </p>
      </LegalSection>

      <LegalSection title="11. Modifications">
        <p>
          Cette politique peut évoluer. En cas de changement important, nous vous en informons
          par e-mail ou dans l'application. La date de mise à jour figure en haut de cette page.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}