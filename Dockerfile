# ===============================
# 1️⃣ Builder Stage
# ===============================
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files and install all dependencies (for build)
COPY package*.json ./
RUN npm ci

# Copy full project source
COPY . .

# Generate Prisma client before building (ensures correct types)
RUN npx prisma generate

# Build NestJS app (outputs to /app/dist)
RUN npm run build


# ===============================
# 2️⃣ Production Stage
# ===============================
FROM node:20-alpine AS production
WORKDIR /app

# Copy only package files first for dependency installation
COPY package*.json ./

# Install production dependencies only (no devDeps)
RUN npm ci --omit=dev && npm cache clean --force

# Copy build artifacts and Prisma schema from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Optionally copy your .env file (or mount it at runtime)
COPY .env .env

# Environment variables
ENV NODE_ENV=production
ENV PORT=8000

# Expose app port
EXPOSE 8000

# Generate Prisma client (ensures runtime schema compatibility)
RUN npx prisma generate

# Optional: Verify build before starting (so Docker fails early if dist missing)
RUN test -f dist/main.js || (echo "❌ Build output not found: dist/src/main.js" && exit 1)

# Start the NestJS app
CMD ["node", "dist/src/main.js"]
