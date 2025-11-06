# 1️⃣ Builder stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the entire source
COPY . .

# 🔧 Generate Prisma client BEFORE build (fixes missing @prisma/client types)
RUN npx prisma generate || echo "⚠️ Prisma client not generated"

# Build NestJS application
RUN npm run build

# 2️⃣ Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built app and Prisma schema
# COPY --from=builder /app/dist ./dist
# COPY --from=builder /app/prisma ./prisma
# COPY .env .
  COPY . . 
# Environment variables
ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000

# Prisma client generation (optional, ensures runtime compatibility)
RUN npx prisma generate || echo "⚠️ Prisma schema not found at runtime"

# Start the app
CMD ["node", "dist/src/main.js"]
