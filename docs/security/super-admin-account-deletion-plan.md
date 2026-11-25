# Sécurité des rôles et suppression de compte (préparation locale)

> État au 24 novembre 2026 : fichiers préparés dans la branche
> `codex/super-admin-account-security`. Aucune migration, requête ou donnée
> distante n'a été modifiée. Ne pas appliquer le SQL avant rapprochement avec
> l'historique réel des migrations Supabase et confirmation de l'UUID propriétaire.

## Décisions de sécurité

- Le rôle métier reste `profiles.role` (`pro`, `patient`, `subscriber`).
- `super_admin` est indépendant et stocké dans `private.user_roles` ; aucun champ
  de profil, `user_metadata` ou requête navigateur n'accorde ce privilège.
- Les fonctions privilégiées prennent leurs décisions à partir d'une identité
  Auth validée côté serveur et d'une lecture `private.user_roles` côté serveur.
- Les formules métier restent dans `profiles.plan`. `subscriber_billing.status`,
  `billing_plan`, les identifiants Stripe et les paiements sont des états
  financiers : le professionnel ne les écrit pas. Le trigger de facturation
  compare toutes les colonnes JSON de la ligne et n'autorise côté professionnel
  que `managed_by_pro` et `updated_at`, après vérification du rattachement.
  Les INSERT/UPDATE/DELETE directs via les policies Authenticated sont retirés ;
  le RPC `set_patient_plan` n'actualise que la formule et `managed_by_pro`, et
  un nouveau suivi manuel utilise `status='none'` sans renseigner d'ID Stripe.
  Les lectures restent limitées au compte, à son professionnel rattaché et au
  super_admin actif. Le webhook et les Edge Functions serveur continuent d'écrire
  avec le rôle `service_role`.
- Le trigger d'inscription ignore `role` et `pro_id` reçus dans les métadonnées.
  Seule une Edge Function de confiance peut rattacher un patient après vérification.
- L'invitation patient réserve d'abord le dossier, puis lie le compte Auth et le
  profil dans une transaction SQL. Le `request_id` en métadonnée Auth sert seulement
  à récupérer une invitation interrompue ; il n'accorde aucun rôle. L'appel Auth
  et la transaction PostgreSQL ne peuvent pas être atomiques entre eux : si le
  résultat Auth est incertain, la réservation est conservée pour éviter une
  seconde invitation automatique.

## Identifier et protéger le propriétaire

Une lecture antérieure a relevé un UUID candidat, mais il n'a pas été confirmé
par le propriétaire dans une session Dashboard Auth. Cet UUID n'est plus codé
dans la migration et aucun super_admin n'est attribué automatiquement. Avant
toute attribution, ouvrir Supabase Dashboard → Authentication → Users, confirmer
l'UUID du compte propriétaire et vérifier que son profil correspond. Ne pas se
fier à l'adresse e-mail seule ni à un rôle `pro`.

Après validation explicite du SQL, un administrateur de base de données pourra
appeler `public.bootstrap_first_super_admin(uuid, uuid)` avec l'UUID confirmé
deux fois. La fonction est révoquée aux rôles API, dont `service_role` ; elle ne
doit être appelée qu'en session SQL administrative. Les futurs administrateurs
seront gérés côté serveur avec `set_super_admin`. Les fonctions de comptage,
de révocation et de suppression tiennent compte des comptes Auth non bannis et
utilisent un verrou transactionnel pour préserver le dernier administrateur actif.
Ne jamais exposer un rôle DB ou une clé service-role au navigateur.

## Suppression : logique prévue et limite actuelle

`delete-account` vérifie le JWT auprès de Supabase Auth et l'autorisation côté
serveur. La suppression reste désactivée : la fonction accepte les anciens noms
de champs des écrans et retourne une indisponibilité sans créer de job ni toucher
aux données. Lorsqu'elle sera prête, le contrat exigera la confirmation exacte
`DELETE <UUID>` et un `request_id` idempotent, puis l'autorisation sera répétée
par `begin_account_deletion` dans PostgreSQL. Les professionnels sont limités
aux patients/abonnés rattachés. Les comptes professionnels ayant encore des
patients sont refusés jusqu'à réattribution ou suppression métier de ces dossiers.
Le dernier super_admin ne peut être supprimé. Les comptes patients/abonnés ne
peuvent demander que leur propre compte.

La fonction locale s'arrête actuellement avant tout effet externe avec
`SUPPRESSION_TEMPORAIREMENT_INDISPONIBLE_REFERENCE_STORAGE`. Elle ne crée plus
de job ni ne bloque le compte lors de ce préflight. C'est intentionnel : le dépôt montre les
buckets `feed`, `message-attachments` et `program-pdfs`, mais plusieurs chemins
sont construits à partir d'IDs de patients/programmes et ne sont pas tous
préfixés par l'UUID utilisateur. Supprimer par préfixe serait dangereux et
pourrait laisser des objets orphelins. Avant d'activer la suppression complète,
cartographier tous les champs qui stockent des chemins d'objets, écrire une
fonction de préflight exhaustive par bucket, puis supprimer les objets avant
`auth.admin.deleteUser`. En cas de doute ou d'échec, conserver un job `failed`,
bloquer l'accès et permettre une reprise idempotente.

Après validation Storage, l'ordre requis est : journal durable et verrou →
préflight des références et réassignations → annulation des abonnements Stripe
actifs via Billing API → suppression Storage par chemins vérifiés → suppression
Auth en dernier (les clés étrangères doivent refuser toute référence non traitée)
→ job terminé. Conserver les factures/transactions et les informations exigées
par les obligations légales ; ne pas effacer le client Stripe ou les factures.
Le statut payé demeure piloté par les webhooks Stripe.

## SQL et compatibilité

Le fichier `db/migrations/013_privileged_roles_and_account_deletion.sql` est un
brouillon. Le dossier local `db/migrations` ne définit pas `subscriber_billing`
ni les fonctions `pro_set_billing_mode` et `pro_set_subscriber_plan` : leurs
colonnes, propriétaires, grants et policies actifs restent à confirmer. Le
dossier local ne représente pas non plus toutes les migrations déjà présentes
dans le projet distant. Le SQL ne doit pas être copié
ou exécuté avant d'avoir comparé le schéma actif, toutes les policies, les
signatures et privilèges des RPC, ainsi que les contraintes FK. Aucun rollback
automatique n'est prévu pour les suppressions de compte ; le rôle et les policies
peuvent être retirés via migration inverse, mais les données supprimées ne sont
pas récupérables sans sauvegarde.

Points de contrôle SQL obligatoires avant staging :

1. confirmer les types/valeurs effectives des enums plan/rôle et du statut billing ;
2. comparer la définition actuelle de `set_patient_plan` et ses appels ;
3. inventorier les policies de chaque table et valider le garde RLS restrictif ;
4. inventorier les clés étrangères et le comportement de suppression en cascade ;
5. vérifier l'accès au moins à un super_admin avant et après attribution ;
6. restaurer une sauvegarde en staging et tester la migration inverse.

## Tests prévus et déploiement

Le test unitaire local couvre super_admin, dernier admin, professionnel rattaché
ou non, patient/abonné et professionnel avec dossiers. Il ne remplace pas les
tests d'intégration PostgreSQL avec cinq utilisateurs fictifs (admin, pro A,
pro B, patient A, patient B), ni les essais d'Edge Function, Storage et Stripe.

Ordre de livraison : terminer l'inventaire schéma/fichiers → exécuter migration
en staging → vérifier les rôles et policies avec les cinq comptes → tester
suppression annulée/reprise et webhook Stripe → sauvegarder → migration de
production approuvée séparément → déployer les Edge Functions → confirmer les
journaux et la session propriétaire. Aucun de ces actes distants n'a eu lieu.

Revue fiscale Stripe : aucune configuration Stripe Tax n'a été modifiée ; les
taxes et obligations de facturation doivent rester dans une revue séparée.
