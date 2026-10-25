# Submissions service for chsmesh.org (see docs/cms-and-submissions.md).
# Base image pinned by digest like the main Dockerfile. To update:
#   docker pull node:22-alpine && docker image inspect --format '{{index .RepoDigests 0}}' node:22-alpine
FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914

WORKDIR /app
COPY package.json server.mjs lib.mjs time-zone.mjs ./

ENV NODE_ENV=production \
    PORT=3000

# The stock image ships an unprivileged `node` user (uid 1000).
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server.mjs"]
