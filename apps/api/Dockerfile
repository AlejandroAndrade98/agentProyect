FROM node:20-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN corepack pnpm install --frozen-lockfile
RUN corepack pnpm --filter @sales-ai/api build
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
