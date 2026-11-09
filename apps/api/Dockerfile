FROM node:25-alpine AS build
RUN npm install -g pnpm@11.5.2
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @forgeops/api --ignore-scripts
COPY apps/api apps/api
RUN pnpm --filter @forgeops/api exec prisma generate && pnpm --filter @forgeops/api build

FROM node:25-alpine AS api
RUN npm install -g pnpm@11.5.2
ENV NODE_ENV=production
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod --filter @forgeops/api --ignore-scripts \
  && rm -rf /root/.local/share/pnpm /root/.cache /usr/local/lib/node_modules /opt/yarn-* \
  && find /usr/local/bin -type l -delete
COPY --from=build /repo/apps/api/dist apps/api/dist
WORKDIR /repo/apps/api
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]

FROM api AS worker
USER root
RUN apk add --no-cache docker-cli docker-cli-buildx
CMD ["node", "dist/worker.js"]

FROM build AS migrate
RUN rm -rf /usr/local/lib/node_modules /opt/yarn-* && find /usr/local/bin -type l -delete
WORKDIR /repo/apps/api
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]
