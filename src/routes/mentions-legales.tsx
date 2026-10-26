import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";


export const Route = createFileRoute("/mentions-legales")({
  head: () => ({ meta: [{ title: "Mentions légales — DietFitPro" }] }),
  component: MentionsLegalesPage,
});


function MentionsLegalesPage() {
  return (
    <LegalLayout title="Mentions légales" updatedAt="14 octobre 2026">
      <LegalSection title="Éditeur du site">
        <p>
          Le site et l'application DietFitPro sont édités par <strong>David Rebot</strong>,
          entrepreneur individuel (EI), exerçant en micro-entreprise.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Activité : Diététicien Nutritionniste et Coach Sportif</li>
          <li>SIRET : 789 355 013 00010</li>
          <li>Adresse : Paris, France</li>
          <li>E-mail : dietfitpro26@gmail.com</li>
          <li>Directeur de la publication : David Rebot</li>
          <li>TVA non applicable, article 293 B du Code général des impôts</li>
        </ul>
      </LegalSection>


      <LegalSection title="Hébergement">
        <p>
          L'application est hébergée par Cloudflare, Inc., 101 Townsend Street, San Francisco,
          CA 94107, États-Unis. [À VÉRIFIER AU MOMENT DE LA MISE EN LIGNE]
        </p>
        <p>
          Les données des utilisateurs (comptes, profils, programmes) sont stockées par Supabase,
          sur des serveurs situés en Allemagne (région de Francfort, Union européenne).
        </p>
      </LegalSection>


      <LegalSection title="Nature du service">
        <p>
          DietFitPro est un service de suivi nutritionnel et sportif. Les repères, programmes et
          conseils proposés sont indicatifs et ne remplacent ni un avis médical, ni un diagnostic,
          ni un traitement. En cas de pathologie, de grossesse ou de doute, consultez un
          professionnel de santé.
        </p>
      </LegalSection>


      <LegalSection title="Propriété intellectuelle">
        <p>
          L'ensemble des contenus de l'application (textes, programmes, visuels, logo, structure)
          est la propriété de l'éditeur, sauf mention contraire. Toute reproduction, copie ou
          diffusion sans autorisation écrite préalable est interdite.
        </p>
      </LegalSection>


      <LegalSection title="Données personnelles">
        <p>
          Le traitement de vos données personnelles est décrit dans notre{" "}
          <a href="/confidentialite" className="font-medium text-[#2D7A1F] hover:underline">
            politique de confidentialité
          </a>
          .
        </p>
      </LegalSection>


      <LegalSection title="Conditions de vente et médiation">
        <p>
          Les conditions d'abonnement et d'achat sont détaillées dans nos{" "}
          <a href="/cgv" className="font-medium text-[#2D7A1F] hover:underline">
            conditions générales de vente
          </a>
          , qui précisent également le dispositif de médiation de la consommation.
        </p>
      </LegalSection>


      <LegalSection title="Contact">
        <p>
          Pour toute question concernant le site, écrivez-nous par e-mail à
          dietfitpro26@gmail.com.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}