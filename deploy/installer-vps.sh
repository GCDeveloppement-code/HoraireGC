#!/usr/bin/env bash
# Installation en une fois sur le VPS (à lancer en root ou avec sudo) :
#   curl -fsSL https://raw.githubusercontent.com/GCDeveloppement-code/HoraireGC/main/deploy/installer-vps.sh | sudo bash
# ou, depuis un clone : sudo bash deploy/installer-vps.sh
#
# Ce que ça fait : installe Docker s'il manque, crée /srv/heures-sup-gc/prod avec le docker-compose.yml
# et un .env aux secrets générés, crée un utilisateur `deploy` avec une clé SSH pour GitHub Actions,
# et affiche ce qu'il reste à coller dans GitHub. Ça ne lance pas l'appli : c'est le premier push sur `main` qui le fait.
set -euo pipefail

DOMAINE="${DOMAINE:-horaire.gcdeveloppement.fr}"
REPO="${REPO:-GCDeveloppement-code/HoraireGC}"   # dépôt GitHub
IMAGE_BASE="ghcr.io/$(echo "$REPO" | tr '[:upper:]' '[:lower:]')"
OWNER="${REPO%%/*}"
DIR=/srv/heures-sup-gc/prod
DEPLOY_USER=deploy

echo "› Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null

echo "› Utilisateur $DEPLOY_USER (déploiement par GitHub Actions)"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"
mkdir -p "/home/$DEPLOY_USER/.ssh"
if [ ! -f "/home/$DEPLOY_USER/.ssh/github_actions" ]; then
  ssh-keygen -t ed25519 -N "" -C "github-actions heures-sup-gc" -f "/home/$DEPLOY_USER/.ssh/github_actions" >/dev/null
  cat "/home/$DEPLOY_USER/.ssh/github_actions.pub" >> "/home/$DEPLOY_USER/.ssh/authorized_keys"
fi
chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
chmod 700 "/home/$DEPLOY_USER/.ssh"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"

echo "› Dossier $DIR"
mkdir -p "$DIR"
if [ -f "$(dirname "$0")/docker-compose.vps.yml" ]; then
  cp "$(dirname "$0")/docker-compose.vps.yml" "$DIR/docker-compose.yml"
else
  curl -fsSL "https://raw.githubusercontent.com/$REPO/main/deploy/docker-compose.vps.yml" -o "$DIR/docker-compose.yml"
fi
if [ ! -f "$DIR/.env" ]; then
  cat > "$DIR/.env" <<EOF
IMAGE=$IMAGE_BASE:main
DOMAINE=$DOMAINE
PORT_LOCAL=3010
POSTGRES_PASSWORD=$(openssl rand -hex 24)
AUTH_SECRET=$(openssl rand -base64 48 | tr -d '\n')
APP_URL=https://$DOMAINE
SEED_PASSWORD=$(openssl rand -hex 4)
SEED_AU_DEMARRAGE=1
EOF
  chmod 600 "$DIR/.env"
fi
chown -R "$DEPLOY_USER:$DEPLOY_USER" /srv/heures-sup-gc

echo "› Accès à GHCR (images privées)"
echo "  Si le dépôt GitHub est privé, connecte le VPS au registre une fois :"
echo "    sudo -u $DEPLOY_USER docker login ghcr.io -u $OWNER   (mot de passe : un token GitHub read:packages)"

PORT_80_LIBRE=1
if ss -ltn 2>/dev/null | grep -qE ':(80|443)\s'; then PORT_80_LIBRE=0; fi
SSH_PORT="$(grep -Ei '^\s*Port\s+[0-9]+' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null | awk '{print $NF}' | tail -1)"
SSH_PORT="${SSH_PORT:-22}"

cat <<EOF

================================================================================
 Reste à faire
================================================================================
1. Dans GitHub → dépôt $REPO → Settings → Secrets and variables → Actions :
     VPS_HOST     = $(hostname -I 2>/dev/null | awk '{print $1}')
     VPS_PORT     = $SSH_PORT
     VPS_USER     = $DEPLOY_USER
     VPS_SSH_KEY  = (colle intégralement la clé privée ci-dessous)

$(cat "/home/$DEPLOY_USER/.ssh/github_actions")

2. Pousse la branche main : GitHub Actions construit l'image et lance l'appli ici, dans $DIR.

3. Exposition HTTPS de $DOMAINE :
EOF
if [ "$PORT_80_LIBRE" = "1" ]; then
  cat <<EOF
   Rien n'écoute sur 80/443 : Caddy peut gérer le HTTPS tout seul. Après le premier déploiement :
     cd $DIR && sudo -u $DEPLOY_USER docker compose --profile caddy up -d
EOF
else
  cat <<EOF
   Un service écoute déjà sur 80/443 (ton reverse proxy). Ajoute un vhost $DOMAINE → http://127.0.0.1:3010
   Exemples : deploy/reverse-proxy.md
EOF
fi
cat <<EOF

4. Mot de passe provisoire des comptes créés par le seed : voir SEED_PASSWORD dans $DIR/.env
   (puis passe SEED_AU_DEMARRAGE=0 dans ce .env après le premier démarrage).
================================================================================
EOF
