#!/bin/sh
# Applique les migrations en attente puis démarre l'appli.
set -e
echo "› Migrations Prisma"
npx prisma migrate deploy
if [ "$SEED_AU_DEMARRAGE" = "1" ]; then
  echo "› Seed de l'équipe (comptes existants conservés)"
  npx prisma db seed || echo "seed ignoré"
fi
echo "› Démarrage Next.js"
exec npm start
