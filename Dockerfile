# syntax=docker/dockerfile:1

# Build the React client and the bundled Node server.
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY tsconfig.json ./
COPY client ./client
COPY server ./server
COPY shared ./shared
COPY scripts ./scripts
RUN npm run build

# Runtime image: only production dependencies + build output.
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

EXPOSE 8080
CMD ["node", "server/dist/index.js"]
