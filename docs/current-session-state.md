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

## 4. Estado Actual
La Fase 1 ha sido completada exitosamente. El entorno de desarrollo está estable y el scaffolding del monorepo compila correctamente.

## 5. Archivos Importantes Creados
- `package.json`, `turbo.json`, `pnpm-workspace.yaml`.
- `docker-compose.yml`, `.env.example`.
- `apps/web/`, `apps/api/`, `apps/worker/` (Shells con Dockerfiles y tsconfigs).
- `packages/database/`, `packages/shared/`, `packages/ai/` (Shells).
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

## 8. Próximos Pasos Exactos
1. Iniciar **Fase 2 (Prisma Schema y Migraciones)**.
2. Definir el esquema de base de datos multi-tenant.
3. Generar la primera migración y validar la conexión con PostgreSQL.

## 9. Cosas que NO se deben hacer todavía
- **NO** implementar lógica de negocio ni endpoints.
- **NO** implementar autenticación ni servicios de IA.
