# Matrice de tests V1 — entitlements, profils, communauté et fichiers

Ces scénarios sont préparés pour un environnement isolé avec données fictives. Aucun n'a été exécuté contre Supabase. Utiliser des comptes jetables : Super Admin, Professionnel A, Professionnel B, Patient A, Patient B, Abonné Basic A, Abonné Premium A.

## Profils et dossiers

| Acteur | Action | Résultat attendu |
|---|---|---|
| Patient A | Modifier ses champs de profil utilisés dans `subscriber.profile.tsx` | Autorisé; aucune modification des rôles, rattachements, plan ou finances. |
| Professionnel A | Modifier sa fiche `patients` rattachée | Autorisé pour les champs visibles dans `EditPatientSheet` : prénom, nom, email de contact du dossier, téléphone, date de naissance, genre, taille, poids, poids cible, objectif, notes médicales, allergies, actif. |
| Professionnel A | Ajouter mesures, programmes et documents de son patient | Autorisé selon les politiques métier dédiées. |
| Professionnel A | Lire/modifier `profiles` du patient A | Lecture selon policy actuelle; toute mise à jour directe refusée, sauf `set_patient_plan` autorisé. |
| Professionnel A | Changer `patients.user_id`, `patients.pro_id` ou `id` du patient A | Refusé par le trigger 016. |
| Professionnel A | Créer une fiche patient avec `user_id` déjà assigné | Refusé; le rattachement Auth passe par le flux serveur d'invitation. |
| Professionnel A | Accéder au patient B (rattaché à B) | Refusé par RLS et contrôles métier. |
| Abonné Basic A | Modifier `role`, `plan`, `pro_id`, `subscription_tier`, statut/ID Stripe ou email du profil | Refusé. |

## Options Premium individuelles

1. Super Admin attribue à Basic A une option V1 avec motif, début immédiat et expiration future : une ligne audit est créée, acteur/date/motif sont présents et le droit effectif est vrai à partir du début.
2. Basic A vérifie le droit par `get_my_access_rights`; Basic B ne reçoit pas le droit.
3. Super Admin révoque l'option : l'historique garde l'attribution et ajoute la révocation; le droit devient faux.
4. Vérifier avant début et après expiration : le droit est faux.
5. Professionnel A/B, Patient A/B et Abonné Basic A appellent `grant_user_feature`, `revoke_user_feature`, `list_feature_catalog` ou `get_user_feature_history` : refus serveur.
6. Tentatives de grant sur rôle non-Basic, option inconnue, V2, dates invalides et motif vide : refus serveur.
7. `access_recipes`, `ai_coach` et `visio` restent faux pour tous les rôles tant que leur canal V2 est désactivé.
8. Changer le rôle ou les métadonnées Auth d'un utilisateur dans le client ne doit donner aucun droit privilégié.

## Feed et groupes privés

- Pro A crée une publication générale publiée immédiatement; édition/suppression de son contenu publié autorisées.
- Vérifier qu'aucune commande de brouillon/masquage général n'apparaît dans l'espace Pro.
- Super Admin peut ouvrir brouillons et publications masquées via sa console.
- Pro A ne peut pas modérer globalement; propriétaire du groupe ne modère que son groupe.
- Basic sans invitation valide ne rejoint aucun groupe; Basic avec invitation valide peut rejoindre sous les règles actuelles.
- Deux groupes privés : un membre de A ne peut lire contenu, commentaires, réactions, membres ni fichiers de B en appel direct avec UUID/chemin.
- Confirmer les plafonds Premium (5 groupes) et 200 membres sans dépassement; aucun changement des limites commerciales.

## Storage et messagerie

- Valider dans le projet que le plafond global Storage est au moins celui des buckets envisagés; ne pas déployer les propositions 10/20 MiB avant arbitrage.
- Pour les buckets Feed, vérifier 5 MiB patient/abonné et 10 MiB professionnel; rejeter fichier > plafond via upload direct API.
- Vérifier extension/MIME et séparation par rôle, puis lecture, suppression de publication et suppression de pièces jointes non référencées.
- Un nouvel URL de message expire après 30 minutes; l'accès après retrait de conversation ou révocation dépend des policies Storage et du TTL déjà émis.
- Tester le job de renouvellement sur objets copiés fictifs : copie, checksum, mise à jour conditionnelle de référence, suppression différée, reprise à chaque statut et absence d'orphelin.

## Prérequis d'exécution

- Staging isolé et comptes jetables; aucune donnée patient réelle.
- Historique réel des migrations reconcilié avant SQL; exécuter d'abord en transaction sur une base jetable.
- Ne pas exécuter les migrations 013–016 directement sur production à partir de ce dossier.
- Tests manuels d'interface et tests RLS/API doivent être consignés séparément des tests TypeScript locaux.
