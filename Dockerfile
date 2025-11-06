# 1️⃣ Build stage
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 2️⃣ Runtime stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy only what’s needed for production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Environment defaults
ENV NODE_ENV=production
ENV PORT=8000

# Optional Prisma client build (safe if Prisma not used)
RUN npx prisma generate || echo "No Prisma schema found."

EXPOSE 8000
CMD ["node", "dist/src/main.js"]
