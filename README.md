# HoraireGC · Heures Sup GC

Dépôt : github.com/GCDeveloppement-code/HoraireGC

Le compteur d'heures sup de GC Développement. Une journée normale ne demande rien : on ne déclare que les écarts (retard le matin, midi écourté, soirée qui déborde), en un tap, et l'appli calcule le reste. La RH voit tout, demande des confirmations, clôture le mois et exporte pour la paie.

Stack : Next.js 15 (App Router, server actions), React 19, TypeScript, Tailwind 4, Prisma 7 + PostgreSQL, PWA installable.

## Démarrer en local

```bash
cp .env.example .env            # puis ajuste DATABASE_URL et AUTH_SECRET
docker compose up -d            # PostgreSQL local (ou une base à toi)
npm install                     # génère aussi le client Prisma
npm run db:migrate:dev          # applique les migrations
npm run db:seed                 # crée l'équipe de prisma/equipe.json (emails à compléter avant)
npm run dev                     # http://localhost:3000
```

Mot de passe provisoire des comptes du seed : `SEED_PASSWORD` du `.env` (`gc-2026` par défaut). Chacun doit le changer à sa première connexion.

Scripts utiles : `npm test` (calculs), `npm run typecheck`, `npm run lint`, `npm run db:studio`.

## Comment ça marche

Chaque personne a des horaires de référence (par défaut 9h · 12h30 · 14h · 17h30, ajustables par la RH). Une déclaration, c'est un moment (matin, midi, soir) et une heure : l'écart par rapport à la référence est positif (heures sup) ou négatif (retard). Une tolérance (15 min par défaut, réglable par la RH) absorbe les petits écarts dans les deux sens : finir à 17h40 ou arriver à 9h10 ne compte pas ; au-delà, l'écart entier est retenu, arrondi au quart d'heure. Le gros bouton de l'écran d'accueil prend l'heure courante. Une déclaration faite un autre jour que le jour concerné est marquée « après coup ». Toute déclaration peut porter un motif, un client et une justification libre.

Les récups se posent en demi-journée ou journée (durées déduites des horaires de la personne). Le solde = solde de départ + heures sup (majorées si la RH l'a décidé) + retards + récups.

L'écran salarié suit l'heure : Aube le matin, Ciel l'après-midi, Soir après 17h30. La vue RH (`/rh`) est la version claire : compteurs du mois, fiche par personne, demande de confirmation ligne par ligne, clôture du mois, export Excel (`/rh/export?mois=YYYY-MM`), règles (tolérance, majoration, arrondi), horaires et comptes.

## Organisation du code

```
prisma/schema.prisma        modèle (User, Declaration, Cloture, Parametres)
prisma/migrations           migrations SQL
prisma/seed.ts + equipe.json seed de l'équipe
src/lib/calcul.ts           règles de calcul (pures, testées dans calcul.test.ts)
src/lib/auth.ts             sessions (cookie JWT signé), utilisateurCourant / utilisateurRH
src/actions/*.ts            server actions (auth, déclarations, RH)
src/app/                    pages : /, /connexion, /reglages/mot-de-passe, /rh, /rh/personnes/[id], /rh/regles, /rh/export
src/components/salarie      écran salarié (Accueil, feuilles, éléments)
src/components/rh           composants de la vue RH
public/manifest.webmanifest, public/sw.js, public/icons   PWA
```

## Git flow et déploiement

Branches : `main` (prod, https://horaire.gcdeveloppement.fr), `develop` (intégration, staging optionnel), `feature/*` depuis `develop`, `hotfix/*` depuis `main`.

À chaque push sur `main`, GitHub Actions construit l'image Docker, la pousse sur GHCR (`ghcr.io/gcdeveloppement-code/horairegc:main`) puis se connecte au VPS en SSH et relance `docker compose` dans `/opt/horairegc`. Un push sur `develop` construit l'image et ne déploie que si la variable de dépôt `STAGING` vaut `true` (dossier `/opt/horairegc-staging`). Au démarrage, le conteneur applique les migrations (`prisma migrate deploy`) et, si `SEED_AU_DEMARRAGE=1`, crée les comptes de `prisma/equipe.json`.

Mise en place du VPS en une fois : `deploy/installer-vps.sh` (Docker, utilisateur `deploy` + clé SSH, dossier `/opt/horairegc`, `.env` aux secrets générés). La clé privée à mettre dans `VPS_SSH_KEY` est `/home/deploy/.ssh/github_actions`. Exposition HTTPS : `deploy/reverse-proxy.md` (Caddy fourni si rien n'écoute sur 80/443, sinon Nginx ou Traefik).

Secrets à créer dans le dépôt GitHub : `VPS_HOST`, `VPS_PORT` (715 sur le VPS GC), `VPS_USER`, `VPS_SSH_KEY`. Ils sont affichés à la fin du script d'installation.

## À faire ensuite

Rappels (récap du vendredi, rappel du soir) par notification push ou email, refacturation des débordements aux partenaires, suppression douce des déclarations avec historique.
