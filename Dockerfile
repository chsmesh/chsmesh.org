# Multi-stage build for chsmesh.org
#
# Both base images are pinned by multi-arch manifest digest so a rebuild can
# never silently pick up a different base image from a mutable tag. Refresh the
# digests deliberately (docker buildx imagetools inspect node:20-slim) as part
# of a reviewed dependency bump.
#
# Stage 1: Build the Astro site
FROM node:20-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0 AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# `npm install --prefer-offline`, not `npm ci`, is deliberate: see commit
# ea43a3d - `npm ci` reliably OOMs in the constrained build environment, while
# `npm install` under the 512 MB heap cap below completes. package-lock.json is
# still committed, so revisit this if the builder ever gets more memory.
RUN NODE_OPTIONS="--max-old-space-size=512" npm install --prefer-offline && \
    test -f node_modules/.bin/astro || (echo "ERROR: astro not installed" && exit 1)

# Ensure installed binaries are in PATH
ENV PATH="/app/node_modules/.bin:$PATH"

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

# The forms POST cross-origin to the n8n webhook host, which is only known at
# build time. Derive scheme://host from PUBLIC_N8N_WEBHOOK_URL and bake it into
# the CSP connect-src placeholder. With no ARG set, the placeholder collapses to
# nothing and connect-src stays 'self'.
RUN set -eu; \
    origin=""; \
    if [ -n "${PUBLIC_N8N_WEBHOOK_URL:-}" ]; then \
        origin=$(printf '%s' "$PUBLIC_N8N_WEBHOOK_URL" | sed -n 's%^\(https*://[^/?#]*\).*%\1%p'); \
    fi; \
    if [ -z "$origin" ]; then \
        echo "WARNING: PUBLIC_N8N_WEBHOOK_URL is unset or not an http(s) URL; CSP connect-src will stay 'self' and form submissions will be blocked by the browser." >&2; \
    else \
        echo "CSP connect-src will allow: $origin"; \
    fi; \
    sed -i "s#__N8N_ORIGIN__#${origin}#g" /app/security-headers.conf

# Build the static site
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine@sha256:72ba65eb42c10344912a84ff42408db7d34f2feb642204570ab8fc5ffd29f1d3 AS runtime

# Copy custom nginx config plus the shared security header include
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/security-headers.conf /etc/nginx/security-headers.conf

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose unprivileged HTTP port
EXPOSE 8080

# Run runtime container as non-root
USER nginx

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
