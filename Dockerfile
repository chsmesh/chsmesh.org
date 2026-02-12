# Multi-stage build for chsmesh.org
# Stage 1: Build the Astro site
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Public env vars for Astro build (baked into static output)
ARG PUBLIC_N8N_WEBHOOK_URL
ARG PUBLIC_N8N_GUIDES_WEBHOOK_URL
ARG PUBLIC_N8N_MEETUPS_WEBHOOK_URL
ARG PUBLIC_N8N_RESOURCES_WEBHOOK_URL

ENV PUBLIC_N8N_WEBHOOK_URL=$PUBLIC_N8N_WEBHOOK_URL
ENV PUBLIC_N8N_GUIDES_WEBHOOK_URL=$PUBLIC_N8N_GUIDES_WEBHOOK_URL
ENV PUBLIC_N8N_MEETUPS_WEBHOOK_URL=$PUBLIC_N8N_MEETUPS_WEBHOOK_URL
ENV PUBLIC_N8N_RESOURCES_WEBHOOK_URL=$PUBLIC_N8N_RESOURCES_WEBHOOK_URL

# Build the static site
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine AS runtime

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose unprivileged HTTP port
EXPOSE 8080

# Run runtime container as non-root
USER nginx

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
