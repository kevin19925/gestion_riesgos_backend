# Backend Gestión de Riesgos - Node 18 + Prisma
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

# Imagen final
FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

EXPOSE 8080

CMD ["sh", "-c", "npx prisma migrate deploy 2>/dev/null || true && node dist/index.js"]
