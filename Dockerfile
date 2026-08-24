# ---- Stage 1 : build du frontend Svelte --------------------------------
FROM node:22-alpine AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html svelte.config.js tsconfig.json vite.config.ts ./
COPY src ./src
RUN npm run build

# ---- Stage 2 : build du backend Rust (axum + rusqlite bundled) ----------
FROM rust:1-alpine AS backend
WORKDIR /build
# rust:alpine inclut gcc/musl-dev, requis pour compiler SQLite bundled.
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/src ./src
RUN cargo build --release --locked

# ---- Stage 3 : runtime minimal ------------------------------------------
FROM alpine:3.21
WORKDIR /app

RUN adduser -D -u 10001 xvault

COPY --from=frontend /build/dist ./dist
COPY --from=backend /build/target/release/xvault ./xvault

# Surcharge config.json pour binder sur toutes les interfaces dans Docker.
RUN echo '{"SERVER_HOST": "0.0.0.0", "SERVER_PORT": 58951, "SERVER_URL": "http://localhost:58951"}' > config.json

RUN mkdir -p /app/data && chown -R xvault:xvault /app

USER xvault
EXPOSE 58951

ENV XVAULT_DB_PATH=/app/data/xVault.sqlite
CMD ["./xvault"]
