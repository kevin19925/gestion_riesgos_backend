# Backend Gestión de Riesgos - Node 18 + Prisma
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar todo antes de npm ci: el postinstall ejecuta "prisma generate && tsc" y necesita prisma/ y src/
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
COPY . .
RUN npm ci
RUN npm run build

# Imagen final: Node 20+ evita ERR_REQUIRE_ESM con Prisma 7 / zeptomatch
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

EXPOSE 8080

# Migraciones las ejecuta el deploy (docker compose exec app npx prisma migrate deploy)
CMD ["node", "dist/index.js"]
