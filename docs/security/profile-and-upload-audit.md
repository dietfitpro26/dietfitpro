# Dossier patient et profil : inventaire V1

Source technique : export de schéma local `docs/security/schema-audit/schema-audit.json` et usages applicatifs recherchés dans le dépôt. Aucun profil réel n'a été lu.

## `public.profiles` (33 champs)

| Champ | Usage / sensibilité observée |
|---|---|
| `id` | UUID Auth et clé de compte; immuable côté utilisateur/pro. |
| `email`, `full_name`, `avatar_url`, `locale` | Compte/préférences personnelles; le patient garde son édition selon les écrans actuels. |
| `role` | Autorisation; jamais éditable par utilisateur/pro. |
| `plan`, `subscription_tier` | Offre commerciale et droits; modifications via parcours métier serveur. |
| `subscription_status`, `stripe_customer_id`, `stripe_subscription_id` | Facturation et identifiants Stripe; contrôles serveur uniquement. |
| `pro_id` | Rattachement; contrôlé par autorisation, jamais librement éditable. |
| `created_at`, `updated_at` | Métadonnées. |
| `age`, `weight_kg`, `height_cm`, `bmi`, `goal`, `target_weight_kg`, `daily_kcal_target`, `gender`, `activity_level`, `is_pregnant_or_breastfeeding`, `program_start_date`, `bmr_kcal`, `tdee_kcal`, `target_kcal`, `target_protein_g`, `target_carbs_g`, `target_fat_g`, `is_minor`, `profile_complete` | Profil personnel / calcul nutritionnel. Le patient les édite actuellement dans `subscriber.profile.tsx`; ne pas retirer ces possibilités. Les champs ayant un double usage de suivi doivent être rapprochés du dossier patient avant toute séparation ACL. |

## `public.patients` (33 champs)

`id`, `user_id`, `pro_id`, `first_name`, `last_name`, `birth_date`, `gender`, `phone`, `email`, `height_cm`, `weight_kg`, `target_weight_kg`, `medical_notes`, `allergies`, `preferences`, `created_at`, `updated_at`, `goal`, `is_active`, `age`, `activity_level`, `is_pregnant_or_breastfeeding`, `program_start_date`, `bmr_kcal`, `tdee_kcal`, `target_kcal`, `target_protein_g`, `target_carbs_g`, `target_fat_g`, `is_minor`, `anamnese`, `anamnese_completed_at`, `anamnese_consent_at`.

### Champs utilisés comme dossier de suivi professionnel

- Identité et rattachement : `first_name`, `last_name`, `email`, `phone`, `birth_date`, `user_id`, `pro_id`.
- Données nutrition/suivi : `height_cm`, `weight_kg`, `target_weight_kg`, `goal`, `age`, `gender`, `activity_level`, `is_pregnant_or_breastfeeding`, `program_start_date`, `bmr_kcal`, `tdee_kcal`, `target_kcal`, `target_protein_g`, `target_carbs_g`, `target_fat_g`, `is_minor`.
- Données particulières de santé : `medical_notes`, `allergies`, `preferences`, `anamnese`, consentements. Accès limité au professionnel rattaché et au patient conformément aux règles produit et à la base légale; toute exposition doit être évaluée particulièrement.
- État : `is_active`, `created_at`, `updated_at`.

L'interface professionnelle consulte `patients`, ses programmes nutrition/sport, ses mesures, rendez-vous et documents. Le code actuel édite la fiche dans `EditPatientSheet`, ajoute des mesures dans `body_measurements` et gère le plan via `set_patient_plan`. Les tableaux de permissions RLS de l'export autorisent au professionnel la gestion des lignes `patients` de son propre `pro_id`; les policies de profils sont plus larges et la migration 013 contient un trigger de garde. Cette revue n'applique aucune restriction aux données patients ni aux possibilités d'édition patient.

# Capacités d'upload : état et propositions à arbitrer

Les plafonds globaux Supabase et la taille réelle du projet ne figurent pas dans l'export (ils ne sont pas des objets du schéma SQL). Aucun réglage Storage distant n'a été consulté.

| Catégorie | Limite patient/abonné trouvée | Limite professionnel trouvée | Proposition de travail |
|---|---:|---:|---|
| Feed | 5 MiB prévue par la migration locale 014 | 10 MiB prévue par 014 et UI | Confirmée par la règle métier 2x; doit encore être validée sur le projet Storage réel avant activation. |
| Programmes PDF (`program-pdfs`) | Upload patient/abonné non trouvé | Le code limite généralement à 10 MiB; bucket exporté à 20 MiB | Conserver 10 MiB pour pro comme limite applicative actuelle. Patient/abonné : sans upload identifié, aucune règle 2x ne s'applique actuellement. |
| Documents patient (`message-attachments`, chemin `patient-docs`) | Upload patient/abonné non trouvé | Le professionnel téléverse des PDF, sans plafond dans l'écran identifié | Proposition à arbitrer : 10 MiB base, 20 MiB pro. Bucket et écran serveur à aligner ensuite. |
| Documents abonnés (`message-attachments`) | Pas d'upload par l'abonné repéré | Professionnel: PDF, pas de maximum applicatif repéré | Proposition à arbitrer : 10 MiB base, 20 MiB pro. |
| Messagerie (`message-attachments`) | Aucun maximum dans l'interface repérée | Aucun maximum dans l'interface repérée | Proposition à arbitrer : 10 MiB patient/abonné, 20 MiB professionnel. Pour >6 MiB, prévoir TUS/resumable pour la fiabilité. |

Les propositions 10/20 MiB sont des plafonds initiaux à faire confirmer, pas des modifications appliquées. Elles se fondent sur les limites de 10 MiB déjà présentes pour plusieurs uploads professionnels; le plafond global réel (Free/Pro/configuration) reste inconnu. Avant d'appliquer une limite, vérifier les paramètres globaux Storage et tester l'upload et la lecture autorisée. Le contrôle React seul ne suffit pas : serveur, bucket et policies Storage doivent converger.
