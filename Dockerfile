# --- Étape 1 : dépendances et build -------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# postinstall lance `prisma generate` : il a besoin d'une DATABASE_URL factice et du schéma
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# --- Étape 2 : image d'exécution ----------------------------------------------
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/package.json /app/package-lock.json ./
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/.next ./.next
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/prisma.config.ts /app/next.config.ts ./
COPY --from=build --chown=app:app /app/src/generated ./src/generated
COPY --chown=app:app deploy/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD wget -qO- http://127.0.0.1:3000/connexion >/dev/null || exit 1
ENTRYPOINT ["./entrypoint.sh"]
