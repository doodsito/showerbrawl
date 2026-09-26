# syntax=docker/dockerfile:1
# Build rapide: cache npm persistant (BuildKit) + couches ordonnees du plus stable au plus volatil.
FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit --no-fund
COPY vite.config.js ./
COPY shared ./shared
COPY client ./client
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --prefer-offline --no-audit --no-fund
COPY server ./server
COPY shared ./shared
COPY --from=build /app/client/dist ./client/dist
# SHA du commit deploye, expose sur /health. En dernier pour ne pas casser le cache des couches.
ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA
EXPOSE 3000
CMD ["node", "server/index.js"]
