FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install
RUN pnpm run build
EXPOSE 3000
CMD ["pnpm", "start"]
