# Vérification du dépôt et connexion réelle

## Limites de phase 1 relues

`PHASE-1.md` a été relu avant clôture de la phase 2. Aucune de ses limites ne bloque l’implémentation locale des avis, de la modération ou du SEO : PostgreSQL est fonctionnel et les parcours authentifiés sont testés avec services locaux. En revanche, l’absence de projet Supabase réellement configuré bloque la connexion de vrais utilisateurs. Les accès S3 et Turnstile sont également requis pour les photos et les écritures de production. Les tuiles réseau, l’import Overpass et la PWA hors-ligne ne sont pas des prérequis du moteur d’avis. Ils ne sont pas déclarés validés par les tests phase 2.

## Secrets

`.gitignore` ignore `.env*`, avec une exception pour le modèle public `.env.example`. Le `.env` local est ignoré, non suivi. Les secrets sont lus dans les variables d’environnement et ne sont jamais inclus dans les réponses publiques. Les identifiants de tests et le mot de passe PostgreSQL local d’exemple sont fictifs ; ne pas les utiliser en production.

`npm run security:secrets` vérifie les fichiers non ignorés et les blobs de l’historique Git accessibles localement (tokens GitHub/Stripe/Supabase, clés AWS, JWT et clés privées). Il n’affiche jamais les valeurs détectées. Cet audit par motifs ne garantit pas la détection de tous les formats de secret ; activer également la détection de secrets GitHub quand disponible. Un secret déjà exposé doit être révoqué, même si le dépôt devient privé.

## Sauvegarde GitHub privée : action encore requise

Le code de phase 1 a été envoyé précédemment vers `AbdessHafi/CodexTest`. La visibilité actuelle n’a pas pu être vérifiée : l’accès API GitHub est refusé (`Forbidden`), y compris la tentative autorisée de passage en privé. Ne pas présenter ce dépôt comme privé et ne pas pousser la phase 2 tant que cette condition n’est pas confirmée.

Depuis votre compte GitHub : ouvrir le dépôt → Settings → General → Danger Zone → Change repository visibility → Make private, si nécessaire. GitHub peut demander de confirmer le nom du dépôt et les conséquences de la modification. Une fois la visibilité privée confirmée, le commit phase 2 peut être poussé dans ce même dépôt pour sauvegarde. Le commit local seul n’est pas une sauvegarde distante.

## Supabase : préparation réalisée, compte à connecter

Aucun accès Supabase Management ni projet existant n’est configuré dans cet environnement ; aucun projet distant n’a été créé. Ne pas envoyer les secrets dans le chat.

1. Dans votre tableau de bord Supabase, créer un projet dans votre organisation, de préférence en région UE. Conserver le mot de passe de la base dans votre gestionnaire de mots de passe.
2. Renseigner dans le `.env` de **votre Mac**, ou dans les paramètres sécurisés de l’hébergeur : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `DIRECT_URL`. Le lien PostgreSQL est fourni par le panneau de connexion Supabase ; choisir la connexion directe pour les migrations si votre réseau le permet, ou le mode session recommandé par Supabase. Ne pas utiliser un pooler en mode transaction pour les migrations. Ne jamais préfixer une connexion DB ou clé serveur par `NEXT_PUBLIC_`.
3. Le fichier `.env` contient des secrets : ne pas le joindre au chat, le mettre dans Git ni le partager. Conserver les certificats/TLS de la connexion PostgreSQL ; ne pas désactiver la vérification.
4. Exécuter `npm run db:migrate` sur le projet cible pour installer PostGIS et les tables. N’exécuter le seed des lieux fictifs que si cette base est une base de démonstration. Mettre `DEMO_MODE=false` pour utiliser la base.
5. Dans Authentication → Providers, activer Email avec confirmation. Dans URL Configuration, définir le Site URL local `http://localhost:3000` et autoriser le retour exact `http://localhost:3000/auth/callback`. Ajouter les URL exactes du vrai domaine lors du déploiement.
6. Pour Google : créer un client OAuth web dans Google Cloud, configurer le consentement et les utilisateurs de test si l’application est en mode test, ajouter l’URL de rappel indiquée dans le fournisseur Google de Supabase (`https://<projet>.supabase.co/auth/v1/callback`), puis enregistrer le client ID et le client secret **dans Supabase**, pas dans le code du navigateur.
7. Configurer SMTP pour l’envoi réel et ses limites. Redémarrer Next.js après modification du `.env`, puis vérifier successivement le lien e-mail et Google avec votre compte. Les paramètres `NEXT_PUBLIC_*` doivent aussi être présents au build de production.

Apple est reporté : bouton masqué et route refusée par défaut. `NEXT_PUBLIC_APPLE_AUTH_ENABLED=false`. Il pourra être activé après configuration du compte développeur Apple et du fournisseur Supabase.

Le brouillon d’environnement cloud concerne uniquement Codex. Le développement sur votre Mac ne nécessite pas de le publier.

## Accès de gestion préparé pour la suite

L’utilisateur a explicitement autorisé la gestion Supabase. Aucun connecteur Supabase ni navigateur pilotable n’est disponible dans cette session : sa connexion dans son propre navigateur n’est pas partagée avec l’environnement. Le brouillon Codex déclare maintenant un secret personnel `SUPABASE_ACCESS_TOKEN` pour `api.supabase.com`, et l’accès réseau à `api.github.com`. L’ajout du secret a automatiquement ajouté `api.supabase.com` aux domaines du brouillon. Ce sont des exigences sans valeur secrète, pas une preuve d’accès opérationnel.

Pour donner cet accès : créer un jeton dans Supabase → Account → Access Tokens, le saisir dans le champ sécurisé `SUPABASE_ACCESS_TOKEN` des paramètres de l’environnement Codex, puis enregistrer et publier la configuration. Ne pas transmettre le jeton dans le chat. Recontrôler ensuite l’accès API, les organisations et projets existants avant de créer un projet pour éviter les doublons. Cette configuration cloud n’est utile que pour déléguer la gestion à Codex ; un usage local autonome sur Mac n’en dépend pas.
