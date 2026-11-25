# Export technique du schéma Supabase

- Projet lié et URL Supabase locale concordants : `mmixqichtdumhqbxjuxf`.
- Date de collecte : 24 novembre 2026.
- Contenu : colonnes, relations, clés, contraintes, fonctions/RPC, triggers, policies RLS, grants, buckets Storage, policies Storage et historique des migrations.
- Aucune ligne de table applicative, aucun compte Auth et aucun objet Storage n’a été demandé.
- Les comptages de lignes renvoyés par l’outil de catalogue ont été supprimés de l’export.
- Les motifs courants de secrets dans les définitions de fonction ont été masqués.

## Méthode et limite

Le dump CLI standard n’a pas été produit : le CLI local a échoué avant le dump avec `DbConfigLoginRoleNetworkError` / `TransportError`. Les métadonnées ont été recueillies avec des requêtes `SELECT` sur les catalogues PostgreSQL via Supabase MCP. Les schémas gérés ne sont pas fournis sous forme de dump SQL intégral ; leurs métadonnées utiles (buckets et policies Storage, migrations enregistrées) sont incluses dans `schema-audit.json`.

Le CLI a affiché `Initialising login role...` avant son échec. Une requête de contrôle a ensuite confirmé qu’aucun rôle `cli_login_postgres%` ne subsistait. Elle ne permet pas de prouver si le CLI avait créé puis expiré un rôle temporaire avant ce contrôle.

L’export est technique et sert à la revue de sécurité. Il ne constitue pas une sauvegarde restaurable.

`schema-audit.json` regroupe le schéma et les métadonnées utiles à la communauté. `community-notification-functions.json` contient la définition du déclencheur de notification de publication, récupérée lors du contrôle final. `cli-login-role-check.json` conserve le résultat du contrôle des rôles temporaires.
