# Stage 1: build the Vue frontend with Tauri shims
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:web

# Stage 2: serve with nginx
FROM nginx:1.27-alpine

# Remove the default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/dist-web /usr/share/nginx/html

# Copy nginx config template — the official nginx image runs envsubst
# on all *.template files in /etc/nginx/templates/ at container start.
COPY nginx/nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
