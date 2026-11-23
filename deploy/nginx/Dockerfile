# Builds the public site and the staff panel, then serves both with nginx.
# Build context is the repository root (see deploy/docker-compose.yml).
FROM node:20-alpine AS frontend
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS panel
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}
WORKDIR /src/panel
COPY panel/package.json panel/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY panel/ ./
RUN npm run build

FROM nginx:1.27-alpine
# The official image renders /etc/nginx/templates/*.template with envsubst (DOMAIN, PANEL_DOMAIN).
COPY deploy/nginx/templates/ /etc/nginx/templates/
COPY deploy/nginx/snippets/ /etc/nginx/snippets/
COPY --from=frontend /src/frontend/dist /srv/frontend
COPY --from=panel /src/panel/dist /srv/panel
