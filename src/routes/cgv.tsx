import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";


export const Route = createFileRoute("/cgv")({
  head: () => ({ meta: [{ title: "Conditions générales de vente — DietFitPro" }] }),
  component: CgvPage,
});


function CgvPage() {
  return (
    <LegalLayout title="Conditions générales de vente" updatedAt="14 octobre 2026">
      <LegalSection title="1. Vendeur et objet">
        <p>
          Les présentes conditions régissent la vente des services proposés sur l'application
          DietFitPro par David Rebot, entrepreneur individuel, SIRET 789 355 013 00010, Paris,
          France, e-mail : dietfitpro26@gmail.com (voir les{" "}
          <a href="/mentions-legales" className="font-medium text-[#2D7A1F] hover:underline">
            mentions légales
          </a>
          ). En passant commande, vous reconnaissez les avoir lues et acceptées.
        </p>
      </LegalSection>

      <LegalSection title="2. Services proposés">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Abonnement Basic : 3 programmes nutrition, journal alimentaire (historique d'un
            mois) et 3 programmes de sport.
          </li>
          <li>
            Abonnement Premium : 12 programmes nutrition, programmes de sport Premium, journal
            alimentaire (historique de trois mois), documents et notes de votre professionnel.
          </li>
          <li>
            Programme personnalisé : programme élaboré pour vous, acheté une seule fois,
            réservé aux abonnés Premium.
          </li>
          <li>Consultation en visio : service annoncé, non disponible à ce jour.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Nature du service et absence de garantie de résultat">
        <p>
          DietFitPro propose des repères et programmes de suivi nutritionnel et sportif. Le
          vendeur est tenu d'une obligation de moyens : il ne garantit aucun résultat
          (perte de poids, prise de masse, performance, amélioration de la santé), qui dépend
          notamment de votre assiduité et de votre situation personnelle. Ces contenus ne
          remplacent ni un avis médical, ni un diagnostic, ni un traitement.
        </p>
      </LegalSection>

      <LegalSection title="4. Vos engagements">
        <ul className="list-disc space-y-1 pl-5">
          <li>Fournir des informations exactes (âge, poids, taille, objectifs, état de santé).</li>
          <li>
            Consulter un professionnel de santé avant de suivre un programme en cas de
            pathologie, de traitement, de grossesse, d'allaitement ou de doute.
          </li>
          <li>Interrompre un programme en cas de gêne ou de douleur et demander un avis médical.</li>
          <li>Garder confidentiels vos identifiants et utiliser le service à titre personnel.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Prix">
        <ul className="list-disc space-y-1 pl-5">
          <li>Abonnement Basic : 9,99 € par mois</li>
          <li>Abonnement Premium : 25,99 € par mois</li>
          <li>Programme personnalisé : 5 €, paiement unique</li>
          <li>Consultation en visio : 30 € par consultation (lorsque le service sera ouvert)</li>
        </ul>
        <p>
          Prix en euros, toutes taxes comprises. TVA non applicable, article 293 B du Code
          général des impôts.
        </p>
      </LegalSection>

      <LegalSection title="6. Essai gratuit de 7 jours">
        <p>
          Lors de votre première souscription, une période d'essai gratuite de 7 jours vous est
          offerte. Aucun prélèvement n'est effectué pendant l'essai. À son terme, l'abonnement
          choisi est automatiquement facturé, sauf résiliation avant la fin de l'essai.
        </p>
      </LegalSection>

      <LegalSection title="7. Paiement et renouvellement">
        <p>
          Le paiement s'effectue en ligne par carte bancaire via la plateforme sécurisée Stripe.
          Le vendeur ne conserve aucune donnée bancaire. Les abonnements sont mensuels et se
          renouvellent automatiquement jusqu'à résiliation.
        </p>
        <p>
          En cas d'échec de paiement, l'accès aux services peut être suspendu jusqu'à
          régularisation. Vos données sont conservées pendant la suspension.
        </p>
      </LegalSection>

      <LegalSection title="8. Résiliation par vous">
        <p>
          Vous pouvez résilier à tout moment depuis votre espace, rubrique « Gérer mon
          abonnement et mes factures ». La résiliation prend effet à la fin de la période
          mensuelle en cours. Le mois entamé reste dû, sans préjudice de votre droit de
          rétractation ci-dessous.
        </p>
      </LegalSection>

      <LegalSection title="9. Droit de rétractation">
        <p>
          Conformément au Code de la consommation, vous disposez de 14 jours à compter de la
          conclusion du contrat pour vous rétracter, sans motif, en écrivant à
          dietfitpro26@gmail.com.
        </p>
        <p>
          Si vous demandez le démarrage immédiat du service, vous devrez, en cas de
          rétractation, régler un montant proportionnel au service déjà fourni. Pour le
          programme personnalisé, si son élaboration commence avec votre accord exprès et que
          vous reconnaissez perdre votre droit de rétractation une fois le service pleinement
          exécuté, ce droit ne s'applique plus après exécution complète. Avant tout paiement,
          vous serez invité à accepter expressément ces points.
        </p>
      </LegalSection>

      <LegalSection title="10. Suspension et fermeture du compte par le vendeur">
        <p>
          Le vendeur peut suspendre ou fermer un compte, après information par e-mail, en cas
          de fraude, de partage ou de revente des contenus, de fausses informations
          délibérées, ou d'usage contraire aux présentes conditions. En cas de fermeture
          injustifiée par le vendeur, la partie de l'abonnement payée et non utilisée est
          remboursée.
        </p>
      </LegalSection>

      <LegalSection title="11. Évolution du service et des prix">
        <p>
          Le vendeur peut faire évoluer les contenus et fonctionnalités pour les améliorer. En
          cas de modification des prix ou d'une modification importante du service, vous êtes
          informé par e-mail au moins 30 jours avant son application et pouvez résilier sans
          frais avant cette date.
        </p>
      </LegalSection>

      <LegalSection title="12. Propriété intellectuelle">
        <p>
          Les programmes, documents, PDF, textes, visuels et la structure de l'application
          sont protégés. Ils sont concédés pour votre usage personnel et privé. Toute
          reproduction, diffusion, revente ou partage est interdit sans autorisation écrite.
        </p>
      </LegalSection>

      <LegalSection title="13. Responsabilité">
        <p>
          Le vendeur répond de ses manquements dans les conditions prévues par la loi. Aucune
          stipulation des présentes ne limite votre droit à réparation lorsque la loi vous le
          garantit.
        </p>
        <p>
          Le vendeur n'est toutefois pas responsable des dommages causés par votre non-respect
          des présentes conditions, par des informations inexactes que vous avez fournies, par
          l'absence d'avis médical préalable lorsque votre situation l'exigeait, par un tiers
          (hébergeur, prestataire de paiement, opérateur de télécommunications), ni en cas de
          force majeure.
        </p>
        <p>
          Le service peut être temporairement indisponible pour maintenance ou raison
          technique ; le vendeur s'efforce d'en limiter la durée.
        </p>
      </LegalSection>

      <LegalSection title="14. Compte et suppression des données">
        <p>
          Vous pouvez supprimer votre compte à tout moment depuis votre profil. La suppression
          annule votre abonnement en ligne et efface définitivement vos données de
          l'application, sauf celles que la loi oblige à conserver (par exemple les
          justificatifs de paiement).
        </p>
      </LegalSection>

      <LegalSection title="15. Personnes mineures">
        <p>
          Les personnes de moins de 18 ans utilisent le service avec l'accord de leur
          représentant légal. Leur programme est établi directement par le professionnel.
        </p>
      </LegalSection>

      <LegalSection title="16. Données personnelles">
        <p>
          Le traitement de vos données, y compris vos données de santé, est décrit dans notre{" "}
          <a href="/confidentialite" className="font-medium text-[#2D7A1F] hover:underline">
            politique de confidentialité
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="17. Médiation de la consommation">
        <p>
          En cas de litige, vous pouvez d'abord contacter le vendeur à dietfitpro26@gmail.com.
          À défaut de solution amiable, vous pouvez recourir gratuitement au médiateur de la
          consommation suivant : [À COMPLÉTER AU MOMENT DE LA MISE EN LIGNE : nom, adresse
          postale et site internet du médiateur].
        </p>
      </LegalSection>

      <LegalSection title="18. Dispositions générales">
        <p>
          Si une clause des présentes était déclarée nulle, les autres clauses resteraient
          applicables. Les présentes conditions sont soumises au droit français. Pour les
          consommateurs, les tribunaux français sont compétents dans les conditions prévues
          par la loi.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}