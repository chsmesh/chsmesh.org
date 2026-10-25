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
# Same-origin path the forms POST to; empty means the default /api/submit.
ARG PUBLIC_SUBMIT_BASE
# Cloudflare Turnstile site key; empty disables the widget.
ARG PUBLIC_TURNSTILE_SITE_KEY

ENV PUBLIC_SUBMIT_BASE=$PUBLIC_SUBMIT_BASE
ENV PUBLIC_TURNSTILE_SITE_KEY=$PUBLIC_TURNSTILE_SITE_KEY

# Build the static site
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine@sha256:72ba65eb42c10344912a84ff42408db7d34f2feb642204570ab8fc5ffd29f1d3 AS runtime

# Copy custom nginx config plus the shared security header include
COPY nginx.conf /etc/nginx/nginx.conf
COPY security-headers.conf /etc/nginx/security-headers.conf

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Fail the build, not the container start, if the config or the substituted
# header include is malformed. Runs as root before the USER switch, and that
# is the catch: `nginx -t` creates the pid file and temp directories named in
# nginx.conf, owned by root. Left in place, the unprivileged runtime user
# cannot open /tmp/nginx.pid and nginx exits at startup. Remove them so a
# plain `docker run` (no tmpfs over /tmp) works exactly like the hardened
# read-only runs, which happen to mask the problem.
RUN nginx -t && rm -rf /tmp/nginx.pid /tmp/nginx-*

# Expose unprivileged HTTP port
EXPOSE 8080

# Run runtime container as non-root
USER nginx

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
