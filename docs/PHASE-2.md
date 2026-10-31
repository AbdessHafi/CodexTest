# Phase 2 — avis, modération et SEO

## Fonctionnalités livrées

### Avis et intégrité

- Cinq notes entières de 1 à 5 : café, cuisine, service, ambiance, rapport qualité-prix ; texte de 20 à 3 000 caractères, date de visite et jusqu’à trois photos.
- Toute écriture exige une session Supabase validée par `getUser`, un e-mail confirmé et un profil persistant. Aucun identifiant utilisateur, rôle, état de publication ou badge de vérification n’est accepté du client.
- Un avis par utilisateur, établissement et date de visite : contrainte PostgreSQL, y compris en cas de requêtes concurrentes. Une réservation ne peut être liée qu’à un avis.
- Badge « Visite vérifiée » exclusivement si la réservation appartient à l’auteur, concerne le même lieu, est terminée, passée et correspond à la date locale Europe/Paris. Le moteur de réservation lui-même reste en phase 4.
- Chaque avis commence en `PENDING`. Les avis publiés seuls alimentent la moyenne globale et les moyennes par critère (poids égaux). Tri par date de dépôt décroissante et identifiant pour départager ; 50 avis affichés, agrégat SQL sur tous les avis publiés.
- Les textes identiques après normalisation sont signalés à la modération, sans rejet automatique. La différence entre e-mail confirmé et visite vérifiée est expliquée dans l’interface.
- Signalement authentifié, avec motif et CAPTCHA ; un signalement par utilisateur/avis ; interdiction de signaler son propre avis. Le signalement n’efface pas automatiquement une opinion.
- Réponse publique unique réservée au rôle `OWNER` lié au lieu avec statut `APPROVED`. Aucun endpoint ne permet d’éditer/supprimer l’avis ou sa note, ni de remplacer une réponse.

### Photos

Les photos sont envoyées avec l’avis via multipart. Le serveur limite le corps à 16 Mo, accepte trois fichiers JPEG/PNG/WebP de 5 Mo maximum, vérifie leur décodage, limite les images à 20 millions de pixels, les réencode en JPEG (1 600 pixels maximum) et retire les métadonnées EXIF. SVG et faux fichiers image sont refusés.

Les objets S3 ont des clés aléatoires ; leurs clés ne sont pas rendues publiques. Le bucket doit être **privé**, sans accès anonyme. L’API de lecture vérifie l’état actuel de l’avis : seuls son auteur et un administrateur peuvent voir une photo non publiée. Les photos publiées sont publiques via l’API ; les photos retirées redeviennent privées. Les réponses sont `private, no-store` pour ne pas conserver un contenu modéré dans un cache applicatif. Une copie déjà téléchargée par un visiteur ne peut naturellement pas être révoquée.

En cas d’échec d’insertion, le serveur tente de supprimer les objets déjà téléversés. Un arrêt brutal du processus peut laisser un objet orphelin privé ; prévoir une réconciliation/lifecycle du stockage en production. Sans configuration S3, les avis sans photo restent possibles et une tentative avec photo reçoit un message explicite.

### Administration

`/admin/moderation` exige le rôle `ADMIN`. La file affiche les avis en attente et ceux avec signalements ouverts, leurs critères, textes, photos, preuve de visite et alertes de copie. Les 100 premiers sont affichés ; les suivants apparaissent au traitement des premiers.

Décisions : publier/maintenir publié, rejeter/retirer, classer les signalements sans modifier l’état de l’avis. Chaque décision exige un motif (10 à 1 000 caractères). Le changement d’état, la clôture des signalements et l’audit sont transactionnels, avec verrou de ligne pour sérialiser signalements/réponses/modération. Le journal conserve l’acteur, l’état avant/après, le motif et les signalements concernés. L’interface montre les 50 dernières décisions ; les enregistrements précédents restent en base. Aucune promotion administrateur n’est accessible depuis une inscription ou une route publique : attribuer ce rôle via l’administration sécurisée de la base à un compte existant.

### Anti-abus

Zod valide chaque écriture ; l’origine des POST est contrôlée. Les limites sont atomiques et persistées dans PostgreSQL, partagées entre instances : cinq tentatives par compte/action par fenêtre fixe de 15 minutes pour avis, signalements et réponses ; 100 décisions de modération. Les identifiants proviennent de la session validée, jamais d’un en-tête IP fourni par le navigateur. Les méthodes d’édition/suppression ne sont pas exposées. Les nouvelles tables ont la RLS activée sans politique publique ; les routes serveur restent le point d’accès aux données.

Le hook CAPTCHA utilise Cloudflare Turnstile, contrôle `success`, `hostname` et `action`, et échoue fermé si la configuration, le jeton ou le service manque. Aucun secret n’est exposé au client. `CAPTCHA_MODE=disabled` permet uniquement le développement/test hors production ; cette option est ignorée en production. Les protections Supabase et celles de l’hébergeur doivent également rester actives.

## Configuration et migration

```sh
npm ci
npm run db:migrate
npm run dev
```

Conserver le `.env` existant, ajouter les variables manquantes depuis `.env.example`. Mettre `DEMO_MODE=false` pour collecter des avis ; le catalogue embarqué en mémoire n’accepte pas d’avis persistés. Configurer Supabase Auth et PostgreSQL comme indiqué dans le README.

Pour CAPTCHA : `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (publique), `TURNSTILE_SECRET_KEY` (secrète), `CAPTCHA_HOSTNAME` (hostname exact, sans schéma/port). En production, renseigner les clés réelles et le domaine exact. Accès HTTPS nécessaire à `challenges.cloudflare.com` depuis le serveur et le navigateur.

Pour les photos : `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Utiliser un bucket privé et des droits limités `PutObject`, `GetObject`, `DeleteObject` sur le préfixe `reviews/`. Le serveur transfère les images : aucun accès CORS direct du navigateur au bucket n’est requis. Ne jamais mettre ces secrets dans Git ou dans des variables `NEXT_PUBLIC_*`.

Migration `0001_uneven_banshee.sql` : empreinte de texte et alerte d’abus des avis, index de file, table de photos privées, compteurs persistants et contrainte d’unicité des signalements. La phase 1 ne créait pas de signalements métier ; si une base modifiée indépendamment contient déjà des doublons reporter/cible, les examiner avant d’appliquer la nouvelle contrainte. Les fiches, utilisateurs et avis existants sont conservés.

## SEO

- Fiches SSR `/lieux/[slug]` : canonical, titre/description, Open Graph, Twitter et JSON-LD `CafeOrCoffeeShop` (ou `Restaurant` pour brunch).
- `AggregateRating` n’est ajouté que pour un lieu non fictif avec au moins un avis publié, et reprend les mêmes notes que l’affichage. Aucun score vide ou inventé.
- Pages SSR `/villes/[city]` et `/villes/[city]/[neighborhood]`, liens entre ville, quartiers et fiches, `ItemList`, titres et canonicals propres. Le quartier vient des données, sans géographie inventée : un lieu renseigné avec `Paris 11e` produit `/villes/paris/paris-11e` et « Meilleurs brunchs à Paris 11e ». Les quartiers déjà présents, dont Bastille et République, ont leurs propres pages.
- `sitemap.xml` dynamique contient les lieux non fictifs et leurs villes/quartiers ; les fixtures `TEST` sont également exclues. `robots.txt` exclut les routes privées/API, mais ne remplace jamais l’autorisation.
- Les fiches et pages géographiques composées uniquement de lieux fictifs sont `noindex` ; l’accueil du mode démo est aussi `noindex`. Définir `NEXT_PUBLIC_SITE_URL` au vrai domaine avant le build de production.
- JSON-LD sérialisé avec échappement des sorties de balise script. Les tests inspectent les pages sans JavaScript.

## Tests et validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
# PostgreSQL/PostGIS local démarré et migré :
npm run test:reviews:db
# Chromium installé via Playwright, ou variable d’exécutable ci-dessous :
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e:reviews
```

Les tests DB et e2e avec fixtures exigent une **base locale de développement/test** et refusent les hôtes distants. Ne pas les lancer sur une base de production. Les tests d’intégration créent des identifiants aléatoires puis nettoient leurs données. Les e2e utilisent un espace de fixtures explicitement réservé (`e2e-phase2-*` et UUID de test), nettoyé avant/après exécution.

Le parcours navigateur complet utilise PostgreSQL réel et des émulateurs HTTP **locaux de test** pour Supabase Auth et S3. L’application garde ses contrôles habituels (cookies de session, `getUser`, profil/role DB, origine, traitements d’image et permissions photo). Aucun mode d’authentification de test ni route de contournement n’est ajouté au code applicatif. Les fixtures sont exclusivement dans `tests/`.

Résultats de cette session : 19 tests unitaires, 8 tests d’intégration PostgreSQL, 10 tests navigateur de découverte/SEO et 4 tests navigateur du parcours authentifié, tous réussis sur les cibles prévues. Lint, TypeScript et build de production réussis. Les tests couvrent les notes/dates invalides et champs forgés, CAPTCHA fermé et réponse du fournisseur, EXIF/format image, droits et concurrence, badge vérifié, copies, limites persistantes, moyenne publiée, publication/retrait audité, photos privées/publiques et parcours SSR/SEO sur ordinateur et mobile. La CI inclut ces suites.

## Limites et arrêt de phase

Les vrais services Supabase, S3 et Turnstile n’ont pas été testés avec des identifiants de production. Leur configuration reste une condition de mise en ligne des écritures. Les mesures Lighthouse/WCAG, l’examen juridique final, l’outillage RGPD complet et le déploiement restent en phase 6. Les critères de modération sont publiés dans `/avis-et-moderation`, sans garantie de délai ni prétention de validation juridique.

La phase 3 (revendication et tableau de bord propriétaire) n’est pas commencée. Cette phase doit être commitée séparément puis arrêtée pour bilan.

Voir aussi [SECURITY-SETUP.md](SECURITY-SETUP.md) pour la relecture des limites de phase 1, l’audit de secrets, le blocage API GitHub et la préparation de Supabase. Apple est reporté, masqué et désactivé par défaut. La phase 2 reste commitée localement tant que la sauvegarde GitHub privée n’est pas possible.
