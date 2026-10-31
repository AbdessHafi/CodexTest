# Pause Café — phases 1 et 2

Marketplace française de cafés et brunchs. Next.js App Router + TypeScript + Tailwind 4, PostgreSQL/PostGIS + Drizzle, Supabase Auth, MapLibre/OpenStreetMap, next-intl (français, EUR, Europe/Paris).

Drizzle remplace Prisma : option prévue au cahier des charges, elle utilise le pilote PostgreSQL standard et ne nécessite pas les moteurs natifs dont le téléchargement était filtré dans l’environnement cloud.

## Démarrer en moins de 10 minutes

Prérequis : Node.js 24, npm, Docker Compose pour la base (facultative en démo).

```sh
cd /workspace/CodexTest # ou le dossier de votre clone
npm ci
cp .env.example .env
npm run dev
```

Ouvrir l’application sur le port 3000 en local. `DEMO_MODE=true` (valeur par défaut) utilise les 50 lieux embarqués et ne nécessite ni base ni compte. Tous les commerces, adresses, menus et horaires de démo sont fictifs. Les images sont des illustrations CSS locales, pas des photos des commerces. Aucun avis ou score n’est inventé.

### Activer la base

```sh
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run test:db
```

Dans `.env`, mettre `DEMO_MODE=false`, puis redémarrer Next.js. Les migrations et le seed sont réexécutables. Le seed conserve les fiches déjà présentes plutôt que d’écraser les modifications. Ne pas utiliser le mot de passe local d’exemple en production. Les montants sont des centimes d’euro ; les créneaux futurs sont des timestamps avec fuseau.

Le schéma initial de 18 tables anticipe consommateurs/propriétaires/admins, fiches, horaires/exceptions, menus/photos, avis/réponses, réservations/créneaux, favoris/listes, offres/abonnements/paiements/factures, signalements et audit. Index GiST sur la position ; déclencheur de synchronisation des coordonnées ; contraintes de notes et unicité d’avis par visite. La phase 2 ajoute les tables de photos d’avis et compteurs anti-abus ; les fonctionnalités des phases 3–6 restent à implémenter.

Drizzle : `npm run db:generate` génère une migration après évolution du schéma ; inspecter le SQL avant application. La première migration active PostGIS (droits d’installation d’extension requis). RLS activée sur les tables, aucune politique d’accès direct public. Le serveur utilise une connexion DB privilégiée ; elle ne doit jamais être exposée au navigateur. Dans Supabase, utiliser la connexion PostgreSQL serveur avec les permissions adéquates, pas le client public pour écrire les tables métier.

### Authentification Supabase

1. Créer un projet Supabase. La base métier peut être celle de ce projet ou un PostgreSQL/PostGIS séparé. Exécuter les migrations avant la première connexion.
2. Renseigner `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` et `NEXT_PUBLIC_SITE_URL`. Les deux premières valeurs sont des paramètres publics, jamais la clé `service_role`. `DATABASE_URL` et `DIRECT_URL` restent côté serveur.
3. Dans Supabase Auth, activer les liens e-mail, configurer l’URL du site et autoriser exactement `<NEXT_PUBLIC_SITE_URL>/auth/callback`. Configurer SMTP pour une utilisation réelle.
4. Activer Google avec ses identifiants fournisseur et l’URL de rappel indiquée par Supabase. Apple est reporté et désactivé par défaut (`NEXT_PUBLIC_APPLE_AUTH_ENABLED=false`) ; son activation ultérieure exige la configuration fournisseur et la variable à `true`. Aucun fournisseur ne fonctionne sans cette configuration.
5. Utiliser `/connexion`. Échange PKCE côté serveur, session en cookies, profil créé avec le rôle `CONSUMER`. `/compte` exige une session validée ; le proxy Next.js y rafraîchit les cookies avant rendu. Aucun rôle n’est accepté depuis le navigateur ; `requireRole` valide la session puis le rôle persistant pour les futures routes protégées. Les routes d’authentification sont publiques par nature et contrôlent l’origine des POST.

La limite actuelle est globale et locale au processus (5 tentatives/15 minutes), à remplacer par un store partagé avant un déploiement multi-instance. Les limites supplémentaires de Supabase doivent rester actives. CAPTCHA, règles anti-fraude complètes et tests OAuth réels sont encore nécessaires avant la production. En l’absence de configuration, l’interface indique explicitement l’indisponibilité de la connexion.

## Fonctionnalités de cette phase

- Recherche par nom/ville/quartier, accents ignorés ; cinq villes ; catégories, budget, ouvert maintenant en heure de Paris, tags alimentaires et équipements.
- Géolocalisation sur demande, tri par distance et message en cas de refus ; aucun stockage de la position.
- Carte chargée uniquement sur demande, marqueurs liés aux fiches, attribution OpenStreetMap et liste accessible en secours. Les tuiles nécessitent `tile.openstreetmap.org` côté navigateur. Respecter la politique OSM ; fournir un hébergeur de tuiles adapté avant montée en charge.
- Fiches rendues côté serveur : description, adresse, menu, horaires, tags ; aucun bouton de réservation ne simule une transaction.
- Base authentification e-mail/Google/Apple, connexion/déconnexion et rôles serveur.
- Responsive mobile et manifeste PWA. Le cache hors-ligne, la certification d’installabilité et les mesures Lighthouse/WCAG font partie de la phase 6.

## Import OpenStreetMap (facultatif)

```sh
npm run db:import -- Paris
```

Accepte Paris, Lyon, Marseille, Bordeaux ou Lille. Accès HTTPS requis à `overpass-api.de`. Import manuel, borné à une ville, validé par Zod et idempotent sur l’identifiant OSM. Les fiches sont non revendiquées ; les données importées ne remplacent pas les fiches existantes. Les tarifs par défaut sont indicatifs et les horaires inconnus restent absents. Ce n’est pas un import de menus, de notes ou de photos. Les fiches portent l’attribution © OpenStreetMap contributors / ODbL ; respecter les obligations de partage à l’identique. Ne pas exécuter en boucle. L’accès Overpass réel n’a pas été validé dans cette session.

## Vérifications

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
# Si Chromium est déjà installé :
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
# Base démarrée et seedée :
npm run test:db
```

CI : migrations et seed réexécuté sur un service PostGIS, contrôles DB, lint, TypeScript, tests unitaires, build et tests Playwright démo. Les tests navigateur couvrent recherche/filtres/fiches, connexion non configurée, 404, retour carte/liste sans tuiles externes et SEO sans JavaScript, sur ordinateur et mobile. `npm run test:reviews:db` et `npm run test:e2e:reviews` ajoutent les contrôles d’avis/modération avec PostgreSQL local et services HTTP de test. Ils ne valident pas l’authentification réelle ni les tuiles réseau.

Les commandes ci-dessus sont exécutées dans le checkout existant : chaque tâche cloud est déjà isolée, aucun worktree supplémentaire n’est nécessaire.

## État et suite

Phase 1 implémentée et commitée séparément. L’authentification réelle reste dépendante de la configuration Supabase/Google/Apple ; aucun secret n’est commité. Les avis et leur modération sont implémentés en phase 2, avec services Auth/CAPTCHA/S3 à configurer pour une utilisation réelle. Paiements, réservations et revendication restent dans les phases suivantes. Aucun déploiement/publication effectué. Les pages juridiques, le consentement et le durcissement seront nécessaires avant une ouverture au public.

Voir [docs/ROADMAP.md](docs/ROADMAP.md). Voir [docs/PHASE-2.md](docs/PHASE-2.md) pour les avis, la modération, les photos privées, le CAPTCHA et le SEO. Prochaine phase : revendication et tableau de bord propriétaire, après le bilan de phase 2.

[Préparation Supabase et sécurisation du dépôt](docs/SECURITY-SETUP.md).
