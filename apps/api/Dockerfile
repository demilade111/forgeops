FROM node:24-alpine AS build
RUN npm install -g pnpm@11.5.2
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @forgeops/api --ignore-scripts
COPY apps/api apps/api
RUN pnpm --filter @forgeops/api exec prisma generate && pnpm --filter @forgeops/api build

FROM node:24-alpine
RUN npm install -g pnpm@11.5.2
ENV NODE_ENV=production
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod --filter @forgeops/api --ignore-scripts \
  && rm -rf /root/.local/share/pnpm /root/.cache
COPY --from=build /repo/apps/api/dist apps/api/dist
WORKDIR /repo/apps/api
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
