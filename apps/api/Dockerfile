FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install
RUN pnpm run build
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
