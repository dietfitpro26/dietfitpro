# Renouvellement prudent des liens historiques de messagerie

## État local

Les nouveaux liens signés du module messages sont demandés avec un TTL de 30 minutes. Le chemin Storage est maintenant utilisé comme valeur persistée pour les nouveaux messages; l'application signe les pièces jointes à la lecture autorisée et renouvelle le lien au clic après relecture du message sous RLS. Aucun objet Storage réel n'a été lu, copié, supprimé ou modifié.

Supabase ne permet pas de révoquer un seul URL signé. Une rotation de clé de signature révoque tous les liens signés existants du projet; ne pas utiliser cette action comme correction ciblée. Les anciens liens stockés en base peuvent rester porteurs jusqu'à expiration (ancien code émettait jusqu'à un an).

## Procédure future (staging d'abord, aucun lancement dans cette tâche)

1. Ajouter une table de travail privée avec `message_id`, ancien chemin, nouveau chemin aléatoire, `status` (`pending`, `copied`, `verified`, `row_updated`, `old_deleted`, `failed`), tentatives, dernière erreur non sensible, taille/checksum attendus, timestamps et worker. Index unique sur message/ancien chemin pour rendre la reprise idempotente.
2. Énumérer les seuls enregistrements `messages.attachment_url` anciens sous un rôle serveur restreint. Valider les chemins contre le bucket et les préfixes autorisés; aucun chemin fourni par navigateur.
3. Copier vers un chemin aléatoire distinct dans le même bucket avec une opération serveur. Ne pas écraser la source.
4. Relire les métadonnées de destination et vérifier taille, type autorisé et SHA-256 du contenu copié (si disponible, comparer les octets lus par le worker côté serveur). Passer à `verified` seulement après validation complète.
5. Mettre à jour la référence du message conditionnellement (`WHERE id = ... AND attachment_url = ancien_chemin`) et vérifier une seule ligne modifiée. En cas de concurrence, reprendre avec la référence actuelle.
6. Vérifier que la nouvelle référence est accessible au propriétaire de la conversation avec une URL de 30 minutes et refusée aux autres comptes.
7. Supprimer l'ancien objet seulement après mise à jour confirmée et validation de la copie. Marquer `old_deleted`.
8. Reprise: un worker relit l'état; `pending` peut copier, `copied` re-vérifie, `verified` reprend l'update conditionnel, `row_updated` confirme puis supprime l'ancien objet. Chaque étape est transactionnelle au niveau de son état, idempotente et journalisée.
9. Rapporter les compteurs par état et conserver les erreurs pour intervention. Supprimer la table de travail uniquement après période de surveillance et sauvegarde vérifiée.

Les opérations Storage et les lectures de messages doivent être exécutées uniquement avec un backend de confiance, authentification du worker, journal d'audit et sauvegarde vérifiée; aucune clé service ne doit atteindre le navigateur. Il faut tester quota, objets volumineux, conflits, échecs réseau et politiques RLS en staging avant toute production.
