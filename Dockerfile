# Build stage
FROM node:22-alpine AS builder

ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Record the commit in the image so a wrong cache hit is obvious in logs.
RUN printf '%s\n' "$GIT_SHA" > /app/.build-sha && npm run build
RUN npm prune --omit=dev

# Production runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000

USER node

CMD ["node", "build"]
