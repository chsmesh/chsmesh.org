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

# The forms POST cross-origin to the n8n webhook hosts, which are only known at
# build time. Derive scheme://host[:port] from every PUBLIC_N8N_*_WEBHOOK_URL,
# dedupe, and bake the list into the CSP connect-src placeholder. A URL that is
# not a plain http(s) URL fails the build here rather than producing an image
# whose CSP header is malformed. With no ARGs set, the placeholder collapses to
# nothing and connect-src stays 'self'.
RUN set -eu; \
    origins=""; \
    for url in "${PUBLIC_N8N_WEBHOOK_URL:-}" "${PUBLIC_N8N_GUIDES_WEBHOOK_URL:-}" \
               "${PUBLIC_N8N_MEETUPS_WEBHOOK_URL:-}" "${PUBLIC_N8N_RESOURCES_WEBHOOK_URL:-}"; do \
        [ -n "$url" ] || continue; \
        origin=$(printf '%s\n' "$url" | sed -nE 's%^(https?://[A-Za-z0-9.-]+(:[0-9]+)?)([/?#].*)?$%\1%p'); \
        if [ -z "$origin" ]; then \
            echo "ERROR: webhook URL is not a plain http(s)://host[:port]/... URL: $url" >&2; \
            exit 1; \
        fi; \
        case " $origins " in *" $origin "*) ;; *) origins="$origins $origin" ;; esac; \
    done; \
    origins="${origins# }"; \
    if [ -z "$origins" ]; then \
        echo "WARNING: PUBLIC_N8N_WEBHOOK_URL is unset (as are the other PUBLIC_N8N_*_WEBHOOK_URL args); CSP connect-src will stay 'self' and form submissions will be blocked by the browser." >&2; \
    else \
        echo "CSP connect-src will allow: $origins"; \
    fi; \
    sed -i "s#__N8N_ORIGIN__#${origins}#g" /app/security-headers.conf

# Build the static site
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine@sha256:72ba65eb42c10344912a84ff42408db7d34f2feb642204570ab8fc5ffd29f1d3 AS runtime

# Copy custom nginx config plus the shared security header include
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/security-headers.conf /etc/nginx/security-headers.conf

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Fail the build, not the container start, if the config or the substituted
# header include is malformed. Runs as root before the USER switch.
RUN nginx -t

# Expose unprivileged HTTP port
EXPOSE 8080

# Run runtime container as non-root
USER nginx

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
