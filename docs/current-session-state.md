# Current Session State: Sales AI Platform

## 1. Resumen del Proyecto
Plataforma SaaS multiempresa de CRM ligero potenciado por IA para vendedores, agencias y freelancers. El sistema implementa un flujo de "Sugerir $\to$ Revisar $\to$ Aceptar" donde la IA no escribe datos oficiales sin intervención humana.

## 2. Stack Definido
- **Monorepo:** pnpm Workspaces + Turborepo.
- **Frontend:** Next.js, TypeScript, Tailwind CSS (Estructura por features).
- **Backend:** NestJS, TypeScript (Arquitectura modular).
- **Worker:** NestJS + BullMQ + Redis.
- **Base de Datos:** PostgreSQL 16 (Aislamiento multi-tenant mediante `organizationId`).
- **IA:** Capa desacoplada con `AiProvider` interface (OpenAI, Gemini, Anthropic).
- **Infraestructura:** Docker Compose (Build context raíz), Node 20 Alpine.

## 3. Fases Completadas
- [x] **Fase 0:** Documentación técnica, visión de producto y ADRs.
- [x] **Fase 1 (Scaffolding):** Estructura de carpetas, archivos raíz, shells de apps/packages y Dockerfiles mínimos. Validado con `pnpm build` exitoso.
- [x] **Fase 2 (Database & Seed):** Definición de esquema Prisma multi-tenant, migración inicial aplicada y seed de datos demo.

## 4. Estado Actual
La Fase 2 ha sido completada exitosamente. El esquema de base de datos está validado, la migración inicial aplicada y los datos demo insertados. PostgreSQL está corriendo en Docker (localhost:15432).

## 5. Archivos Importantes Creados
- `package.json`, `turbo.json`, `pnpm-workspace.yaml`.
- `docker-compose.yml`, `.env.example`.
- `apps/web/`, `apps/api/`, `apps/worker/` (Shells con Dockerfiles y tsconfigs).
- `packages/database/prisma/schema.prisma`, `packages/database/prisma/seed.ts`.
- `packages/database/prisma/migrations/20260507034039_init/`.
- `docs/` (Vision, Architecture, Security, etc.) y `docs/adr/`.

## 6. Decisiones Técnicas Tomadas
- **Multi-tenancy:** Aislamiento lógico mediante `organizationId` validado en Guards y aplicado estrictamente en la capa de acceso a datos (Prisma).
- **IA:** Patrón Strategy para providers. Flujo obligatorio de revisión humana (`PENDING_REVIEW` $\to$ `ACCEPTED`).
- **Docker:** Contexto de construcción en la raíz para permitir acceso a paquetes compartidos.
- **Build:** Uso de comandos filtrados (`pnpm --filter`) en Dockerfiles.

## 7. Resolución de Problemas de Instalación (Fase 1)
Se resolvieron fallos críticos de `pnpm install` mediante las siguientes acciones:
- **Causa Raíz:** `npm/pnpm` tenía configurado `script-shell` como `cmd.exe`, provocando que los scripts de `postinstall` entraran en modo interactivo y fallaran.
- **Corrección:** Eliminación de `script-shell` de las configuraciones de npm y pnpm.
- **Entorno Establecido:**
  - **Node:** v20.20.2 (vía nvm)
  - **pnpm:** v9.0.0 (vía corepack)
  - **Prisma:** v5.22.0 (fijado para evitar inestabilidades de "latest")
- **Validación Final:** `pnpm install` y `pnpm build` completados exitosamente.

## 8. Detalles de la Fase 2
- **Schema Prisma:** Validado y formateado.
- **Migración Inicial:** `20260507034039_init` aplicada con éxito.
- **Seed Ejecutado:**
  - Org: "Demo Organization" (slug: demo)
  - User: "owner@example.com" (Role: OWNER)
  - Products: Cabify Ads, Programmatic Ads, DOOH, Connected TV.
- **Infraestructura:** PostgreSQL corriendo en localhost:15432.

## 9. Próximos Pasos Exactos
1. Iniciar **Fase 3 (Backend Base)**.
2. Implementar configuración global, health checks y conexión a DB.
3. Implementar Auth (JWT, Refresh Tokens) y gestión de Usuarios/Organizaciones.

## 10. Cosas que NO se deben hacer todavía
- **NO** implementar lógica de negocio comercial ni endpoints de IA.
- **NO** implementar la interfaz de usuario final.
