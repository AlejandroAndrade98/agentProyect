FROM node:20-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN corepack pnpm install --frozen-lockfile
RUN corepack pnpm --filter @sales-ai/web build
EXPOSE 3000
CMD ["corepack", "pnpm", "--filter", "@sales-ai/web", "start"]
