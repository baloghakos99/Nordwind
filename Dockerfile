# --- frontend build ---
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- backend deps (native better-sqlite3) ---
FROM node:22-bookworm-slim AS backend-deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install --omit=dev

# --- runtime ---
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    FRONTEND_DIST=/app/frontend/dist

COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY backend/package.json ./backend/
COPY backend/src ./backend/src
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

RUN mkdir -p /data /data/uploads

EXPOSE 8080
VOLUME ["/data"]
WORKDIR /app/backend
CMD ["npx", "tsx", "src/index.ts"]
