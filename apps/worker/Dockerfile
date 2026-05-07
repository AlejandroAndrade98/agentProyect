FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker
RUN pnpm install
RUN pnpm run build
CMD ["node", "apps/worker/dist/main.js"]
