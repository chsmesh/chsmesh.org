# Network status service for chsmesh.org (see docs/status.md).
# Same base image, pinned by digest, as services/submissions. To update:
#   docker pull node:22-alpine && docker image inspect --format '{{index .RepoDigests 0}}' node:22-alpine
FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914

WORKDIR /app
COPY package.json server.mjs mqtt.mjs mesh.mjs store.mjs hardware.mjs infrastructure.json ./

# Rolling state is saved here; mount a volume to keep history across restarts.
# Owned by the unprivileged `node` user (uid 1000) so a fresh named volume
# inherits writable ownership.
RUN mkdir -p /data && chown node:node /data
VOLUME /data

ENV NODE_ENV=production \
    PORT=3001 \
    STATUS_DATA_DIR=/data

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/healthz || exit 1

CMD ["node", "server.mjs"]
