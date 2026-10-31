# Bilan de phase 1

## Livré

Découverte mobile française, recherche accent-insensible, cinq villes, catégories/budget/horaires/tags, géolocalisation et tri distance, carte MapLibre à la demande, fiches SSR avec menu et horaires, 50 lieux fictifs. Auth Supabase e-mail/Google/Apple avec échange PKCE, cookies, rafraîchissement sur compte, rôle consommateur créé côté serveur, garde de rôle persistante. Schéma Drizzle de 18 tables et migration PostGIS avec index GiST, synchronisation des coordonnées et RLS sans accès public direct. Seed idempotent, importeur Overpass manuel, manifeste PWA, Docker Compose, CI et documentation.

## Validation dans cette session

- Lint et TypeScript : réussis.
- Vitest : 7 tests réussis.
- Playwright : 6 tests réussis (3 parcours sur ordinateur et mobile) après correction de l’origine locale du serveur Next.js.
- Build de production : réussi, y compris le proxy de rafraîchissement.
- Migration et seed : deux exécutions réussies, aucun doublon.
- PostgreSQL/PostGIS : 50 lieux, 150 plats, 350 horaires, 3 offres, coordonnées spatiales et requête de proximité validées ; rôle invalide rejeté.
- Application compilée avec `DEMO_MODE=false` : HTTP 200, recherche et détail/menu persistés, mobile sans débordement, aucun événement `pageerror`, POST d’origine étrangère rejeté avec HTTP 403.
- Captures ordinateur et mobile inspectées localement.

## Limites explicitement non validées

La connexion e-mail/OAuth réelle exige un projet Supabase et les configurations fournisseurs ; aucun identifiant n’a été fourni. L’import Overpass réel et le chargement des tuiles externes n’ont pas été validés. Les tests carte valident l’ouverture/fermeture et le repli hors réseau. Manifeste PWA présent, fonctionnement hors-ligne et score Lighthouse non revendiqués. L’interface indique les fonctionnalités futures plutôt que de simuler des avis, réservations, paiements ou revendications.

Drizzle a été choisi parmi les deux ORM proposés, car Prisma nécessitait un téléchargement de moteur refusé par la politique réseau. Aucune vérification TLS ou checksum n’a été désactivée. L’ajout temporairement proposé pour `binaries.prisma.sh` a été retiré du brouillon réseau, devenu inutile. Instructions cloud `install_script` et `start_skill` enregistrées ; aucune publication ou validation dans une nouvelle tâche n’a été effectuée.

## Étape suivante, non commencée

Phase 2 : collecte d’avis authentifiés et critères de notation, intégrité par visite, modération/signalement, puis pages SEO ville/quartier, données structurées et sitemap. Les vérifications juridiques et le durcissement avant mise en production restent dans la feuille de route.
