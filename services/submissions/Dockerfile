# Submissions service for chsmesh.org (see docs/cms-and-submissions.md).
# Before production use, pin this image by digest like the main Dockerfile:
#   docker buildx imagetools inspect node:22-alpine
FROM node:22-alpine

WORKDIR /app
COPY package.json server.mjs lib.mjs ./

ENV NODE_ENV=production \
    PORT=3000

# The stock image ships an unprivileged `node` user (uid 1000).
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server.mjs"]
