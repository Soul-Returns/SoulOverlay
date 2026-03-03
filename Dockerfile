# Stage 1: build the Vue frontend with pre-fetched static data
FROM node:20-alpine AS builder

ARG UEX_API_KEY

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN UEX_API_KEY=${UEX_API_KEY} npm run fetch:data
RUN npm run build:web

# Stage 2: serve with nginx
FROM nginx:1.27-alpine

# Remove the default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy built assets (includes public/data/ JSON files)
COPY --from=builder /app/dist-web /usr/share/nginx/html

# Copy nginx config (plain config, no envsubst needed)
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
