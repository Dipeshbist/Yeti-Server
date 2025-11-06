# 1️⃣ Builder stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install only prod deps for smaller build
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# 2️⃣ Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Copy only dist, package files, and minimal deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built app from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000

# Prisma client optional
RUN npx prisma generate || echo "No Prisma schema found"

CMD ["node", "dist/src/main.js"]
