# Exposer horaire.gcdeveloppement.fr

L'appli écoute sur `127.0.0.1:3010` (voir `PORT_LOCAL` dans le `.env` du VPS). Trois cas selon ce qui tourne déjà sur le serveur.

## Rien sur les ports 80/443 : Caddy fourni

```bash
cd /srv/heures-sup-gc/prod
docker compose --profile caddy up -d
```

Caddy obtient et renouvelle le certificat Let's Encrypt tout seul pour `DOMAINE`.

## Nginx déjà en place

```nginx
server {
    listen 80;
    server_name horaire.gcdeveloppement.fr;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl http2;
    server_name horaire.gcdeveloppement.fr;
    # certbot --nginx -d horaire.gcdeveloppement.fr
    ssl_certificate     /etc/letsencrypt/live/horaire.gcdeveloppement.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/horaire.gcdeveloppement.fr/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Traefik déjà en place (labels sur le service `app`)

Dans `docker-compose.yml` du VPS, service `app`, remplace le bloc `ports` par :

```yaml
    networks: [default, proxy]
    labels:
      - traefik.enable=true
      - traefik.http.routers.heures-sup.rule=Host(`horaire.gcdeveloppement.fr`)
      - traefik.http.routers.heures-sup.entrypoints=websecure
      - traefik.http.routers.heures-sup.tls.certresolver=letsencrypt
      - traefik.http.services.heures-sup.loadbalancer.server.port=3000
```

et déclare le réseau externe de Traefik (`networks: proxy: external: true`).
