# Phase 3 — espace propriétaire, revendication et carte

Développement sur la branche `phase-3`, avec commits intermédiaires et fusion sur `main` après vérifications. Aucun début de phase 4.

## Revendiquer un établissement

Le CTA d’une fiche non revendiquée mène à un formulaire authentifié : SIRET (14 chiffres, clé de Luhn et cas officiel La Poste), e-mail professionnel, téléphone, fonction propriétaire/gérant et description de l’habilitation. Le justificatif est facultatif : PDF ou image JPEG/PNG/WebP, 5 Mo maximum. Le compte Supabase doit aussi avoir son e-mail confirmé. CAPTCHA et limites par compte s’appliquent.

Un code à six chiffres est envoyé à l’e-mail professionnel, distinct de l’e-mail du compte. Il est généré avec `crypto.randomInt`, stocké uniquement sous forme HMAC liée à la demande, expire en 15 minutes et autorise cinq essais. Les essais incorrects sont persistés même en cas de refus ; le cinquième rejette la demande. Les renvois invalident le code précédent et ne réinitialisent pas les essais. Création, vérification et renvoi ont chacun un plafond de cinq tentatives par compte et fenêtre de 15 minutes en base partagée. Une demande non vérifiée expirée peut être remplacée à la soumission suivante ; elle est clôturée et auditée. Une seule demande `PENDING` est autorisée par établissement, quel que soit le demandeur, puis un seul propriétaire validé par établissement.

Après vérification du code, la demande apparaît dans `/admin/revendications`. L’administrateur examine le SIRET dans le registre officiel, l’activité, l’adresse et l’habilitation du demandeur (contact et justificatif éventuel). Deux confirmations et un motif explicite sont requis pour approuver. **Le contrôle de clé et l’e-mail ne prouvent pas à eux seuls la propriété.** Il n’y a pas d’appel automatique au registre et le téléphone n’est pas vérifié par SMS.

L’approbation est transactionnelle : liaison au lieu, rôle `OWNER`, SIRET, fiche revendiquée, état `APPROVED` et audit. Un même propriétaire peut gérer plusieurs lieux distincts. Le rejet conserve son motif ; aucun administrateur ne peut approuver sa propre demande. Le journal de `/admin/moderation` inclut ces décisions. Les demandes sont suivies dans l’espace professionnel.

Les notifications d’approbation, de rejet et de clôture automatique sont placées dans une outbox transactionnelle. L’API de décision tente un envoi immédiat ; programmer `npm run mail:flush` pour reprendre les échecs et vider les notifications automatiques. Les codes, eux, sont envoyés sans conserver leur valeur en clair dans la base ; un échec permet un renvoi après configuration du mail.

## Justificatifs privés

Le bucket reste privé. Les images sont décodées/réencodées avec suppression EXIF ; les PDF sont limités et contrôlés par signature de fichier, sans prétendre à une analyse antivirus complète. Les PDF sont servis en téléchargement avec `Content-Security-Policy: sandbox` et `nosniff`.

Les liens de consultation sont signés par l’application, expirent en 15 minutes et sont liés au compte qui les reçoit. La signature **et** une session valide d’auteur ou d’administrateur sont nécessaires ; une URL copiée vers un autre compte ne donne pas accès. Ce sont des URL applicatives signées, pas des liens publics directs vers S3. Aucune clé d’objet ou liste de bucket n’est exposée. Définir la rétention documentaire avec le responsable juridique avant collecte réelle ; aucune purge automatique de justificatifs n’est revendiquée à cette phase.

## Espace `/pro`

`/pro` ouvre l’espace professionnel ; les routes historiques `/professionnels/*` restent utilisables. L’aperçu liste les établissements et demandes de l’utilisateur. Chaque fiche ouvre un tableau de bord réservé à son propriétaire approuvé. Le contrôle relit en base le rôle et la liaison à chaque lecture et mutation, y compris pour les produits, photos, exports et statistiques ; aucun ID fourni par le client n’est considéré comme une autorisation.

- Fiche : nom, description en texte simple, adresse, coordonnées, e-mail/téléphone publics, site HTTPS, liens Instagram/Facebook, catégorie principale et types complémentaires, services/tags et budget. Propriété, SIRET, provenance et slug ne sont pas modifiables par ce formulaire.
- Horaires hebdomadaires et exceptions datées : contrôles Zod, unicité des jours/dates, heures valides. Les exceptions priment dans « ouvert maintenant » et sont visibles sur la fiche. Un créneau par jour ; les services après minuit ne sont pas pris en charge.
- Photos de galerie et produits : JPEG/PNG/WebP, 5 Mo, 20 millions de pixels maximum ; réencodage JPEG sans métadonnées, formats 1 600 et 320 pixels maximum, légende accessible, ordre et couverture. Tri par glisser-déposer **ou boutons clavier** ; suppression de la référence publique et tentative de suppression des objets. Les photos du lieu sont publiques via l’API, les justificatifs restent dans un préfixe et des routes distincts. Un arrêt pendant transfert peut laisser un objet privé orphelin ; prévoir la réconciliation S3.
- Carte : catégories, nom, description, prix au centime, tags, allergènes, photo(s), disponibilité, ordre par glisser-déposer/boutons ; 100 produits maximum. Une catégorie est un libellé de produit, modifiable dans son formulaire, sans taxonomie globale séparée.
- CSV : modèle et export protégés par la propriété, import ajoutant 1 à 100 produits sans remplacement silencieux ; CSV UTF-8 séparé par virgules, prix en euros avec point, tags/allergènes séparés par `|`, booléens `true`/`false`. Guillemets et retours de ligne échappés, en-tête exact contrôlé, valeurs dangereuses pour tableur neutralisées à l’export. L’import est validé et transactionnel, sans téléverser de photo par CSV.
- Plats du jour : début/fin de validité, un seul jour si aucune fin. Plat à la une : dates de début/fin. L’affichage dépend de la date Europe/Paris ; un produit indisponible ou un plat du jour hors période n’apparaît pas. La mise à la une ne modifie aucune note ni placement dans la recherche.
- Avis : note globale, nombre d’avis et liens vers les avis publiés sans réponse parmi les 50 plus récents. Les réponses restent celles de phase 2, exclusivement sur la fiche publique, sans édition/suppression de l’avis.

Les mutations propriétaires sont limitées à 60 par compte/15 minutes et auditent l’action et sa cible sans copier les justificatifs ou secrets dans le journal. Les pages publiques restent SSR ; les mutations appellent `revalidatePath('/', 'layout')` pour invalider également les pages géographiques et métadonnées concernées.

## Pages publiques et mesure d’activité

Les fiches affichent carte par catégories, allergènes, plats du jour/à la une, couverture et galerie, contacts et horaires à jour. Une fiche approuvée porte « Établissement vérifié », au sens de la validation manuelle du parcours décrit ci-dessus, pas d’un label de qualité. Les lieux fictifs locaux restent signalés, sans note structurée fictive et exclus du sitemap.

Les vues de page et clics téléphone/site/itinéraire sont agrégés par lieu et jour. Aucun IP brut, user agent, cookie analytique, identifiant visiteur ni historique individuel n’est enregistré dans la table de statistiques. Les favoris sont une action explicite de compte authentifié ; leur relation utilisateur/lieu est stockée pour cette fonctionnalité, mais seules les additions agrégées et le total sont présentés dans les statistiques. Aucun traceur publicitaire n’est ajouté.

Le tableau de bord propose 7/30 jours, graphique des vues, tableau de clics et graphique/tendance des notes publiées avec leurs nombres. Ce sont des **comptages de requêtes**, pas des visiteurs uniques ou une mesure antifraude certifiée : préchargements, robots et rechargements peuvent compter. Un plafond global partagé de 3 000 événements par lieu/15 minutes limite les écritures sans créer d’identifiant visiteur. Les erreurs de statistiques n’empêchent pas de consulter une fiche. La base légale et la notice complète de confidentialité restent à finaliser en phase 6.

## Installer et tester

```sh
npm ci
docker compose up -d db
npm run db:migrate
npm run db:seed
# application normale avec services configurés :
npm run dev
```

Ajouter les variables manquantes de `.env.example` sans écraser les valeurs existantes :

- `RESEND_API_KEY` et `MAIL_FROM` (expéditeur/domaine validé chez Resend) ; accès HTTPS à `api.resend.com`.
- `MAIL_TRANSPORT=resend` pour le service réel ; `local` hors production écrit les courriers en fichiers privés `.local/mail/*.json`, sans les afficher dans les logs. Ce dossier est ignoré par Git. En production, le transport local est refusé.
- `CLAIM_CODE_SECRET` : secret aléatoire d’au moins 32 caractères, stable et partagé entre instances, obligatoire en production. Il protège codes et signatures documentaires. Ne jamais le commiter, le logger ou le préfixer par `NEXT_PUBLIC_`.
- Supabase, Turnstile et S3 : variables de phase 2. Le bucket privé doit autoriser au serveur `GetObject`, `PutObject`, `DeleteObject` sur `reviews/`, `claims/`, `venues/`. Turnstile doit accepter l’action `claim` en plus de `review` et `report`.

Le mode Supabase non configuré affiche une connexion indisponible, redirige les espaces protégés vers la connexion et refuse les API en 401 ; il ne simule pas une authentification de production.

### Démo propriétaire autonome, sans services externes

```sh
# Avec la base PostgreSQL locale migrée :
npm run dev:owner-demo
```

Ce lanceur vérifie que la base est locale, crée/réutilise des comptes **fictifs** owner/admin/claimant, deux établissements locaux et une demande en attente dont l’e-mail est vérifié dans la fixture. Il démarre un fournisseur d’identité et un stockage de démonstration sur `127.0.0.1:54329`, puis Next.js sur la boucle locale. Ouvrir `http://localhost:54329` sur votre ordinateur pour choisir une identité et aller à `/pro`. Le code applicatif conserve son contrôle normal de session puis de rôle/propriété ; aucun endpoint de connexion de démonstration n’est ajouté au code de production.

`npm run db:seed:owner` peut préparer les données seules. Le seed est idempotent et préserve les modifications ; il ne réinitialise pas une demande déjà traitée. La clé de signature de session est générée en mémoire à chaque lancement. Les objets locaux sont dans `.local/storage`, les courriers dans `.local/mail`, avec permissions privées. Les courriers locaux contiennent les codes de test : ne jamais partager ni versionner ce dossier. Les sessions expirent après une heure ; sélectionner à nouveau l’identité. Ne pas exposer ce fournisseur local sur Internet ni l’utiliser pour de vraies identités.

### Vérifications

```sh
npm run lint
npm run typecheck
npm test
npm run test:reviews:db
npm run security:secrets
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e:reviews
```

Les tests DB sont réservés à une base locale dédiée et nettoient leurs fixtures. La suite navigateur avec base inclut maintenant revendication/code, justificatif privé signé, approbation, menu, horaires, photo/couverture, export et refus d’accès à un lieu tiers, sur ordinateur/mobile, ainsi que les scénarios d’avis existants. Les tests unitaires couvrent Luhn, code/expiration/essais, signature privée, formats de preuve, CSV, dates et exceptions. Résultats exécutés : 29 tests unitaires, 17 tests PostgreSQL (dont plusieurs lieux pour le même propriétaire), 10 parcours publics/SEO et 6 parcours authentifiés, tous réussis. Lint, TypeScript, build de production et contrôles de base initiaux réussis. La démo locale a été lancée, connectée avec ses identités owner/admin, capturée sur ordinateur/mobile et inspectée sans débordement ni erreur JavaScript. Aucun secret reconnu détecté par l’audit par motifs des fichiers et de l’historique Git.

## Limites de mise en ligne

Les parcours ont été testés avec PostgreSQL et services locaux ; l’envoi réel Resend, le bucket S3 de production, le fournisseur CAPTCHA et la connexion Supabase distante exigent leur configuration et un essai réel. Aucun SMS n’est envoyé et aucune vérification officielle d’entreprise n’est automatisée. Les PDFs ne font pas l’objet d’une analyse antivirus. La suppression S3 après échec est compensatoire, pas une transaction distribuée. Aucun abonnement, encaissement, réservation ou contrôle SIRET gouvernemental n’est simulé comme réel.

La phase 4 attend la validation de cette livraison.
