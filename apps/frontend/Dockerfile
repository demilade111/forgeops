FROM node:25-alpine AS build
RUN npm install -g pnpm@11.5.2
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/frontend/package.json apps/frontend/
RUN pnpm install --frozen-lockfile --filter @forgeops/frontend
COPY apps/frontend apps/frontend
RUN pnpm --filter @forgeops/frontend build

FROM caddy:2.11
COPY apps/frontend/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/frontend/dist /srv
