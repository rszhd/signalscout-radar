# One image runs the web server, the worker and the migrations. The command
# decides which.
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod
# The web server is Astro's build. The worker and the migrations run their
# TypeScript source directly: Node 24 strips the types.
COPY --from=build /app/dist dist
COPY src/db src/db
COPY src/sort src/sort
COPY src/worker src/worker
RUN find src -name '*.test.ts' -delete
USER node
ENV HOST=0.0.0.0 PORT=4321
EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
