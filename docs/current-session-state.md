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
- [x] **Fase 1 (Scaffolding):** Estructura de carpetas, archivos raíz, shells de apps/packages y Dockerfiles mínimos.

## 4. Estado Actual
El proyecto ha superado la Fase 0 y está en la etapa final de validación de la Fase 1. Se ha configurado el monorepo, pero la instalación de dependencias (`pnpm install`) ha presentado fallos críticos de compatibilidad de versiones.

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

## 7. Problemas Encontrados
- **Incompatibilidad de Node:** Diferencia entre Node v22 (Local) y Node v20 (Docker).
- **Fallos de postinstall:** Errores en `@prisma/engines` y `@nestjs/core` debido a versiones "latest" incompatibles con el entorno.
- **Bloqueos de Archivos:** Errores de "Device or resource busy" al intentar borrar `node_modules` en Windows.

## 8. Problema Actual con `pnpm install`
El comando `pnpm install` falla durante la ejecución de scripts de post-instalación de Prisma y NestJS debido a la versión de Node y al uso de versiones inestables (latest) de las librerías.

## 9. Cambios para Node 20 y Prisma 5.22.0
Para resolver la inestabilidad se ha implementado:
- Creación de `.nvmrc` y `.node-version` con el valor `20`.
- Restricción de `engines` en `package.json` raíz (`>=20 <21`).
- Downgrade de Prisma a la versión estable `5.22.0` en `packages/database/package.json`.
- Eliminación de todas las dependencias "latest" sustituyéndolas por versiones estables.

## 10. Próximos Pasos Exactos
1. Limpiar procesos `pnpm` activos y eliminar `node_modules` y `pnpm-lock.yaml` residuales.
2. Ejecutar `pnpm install --no-frozen-lockfile` con Node 20 activo.
3. Validar que el `pnpm-lock.yaml` real se genere correctamente.
4. Validar que `pnpm build` (vía Turbo) reconozca los scripts base.
5. Cerrar oficialmente la Fase 1.
6. Iniciar Fase 2 (Prisma Schema y Migraciones).

## 11. Comandos Pendientes
- `pnpm install --no-frozen-lockfile --reporter=append-only`
- `pnpm --version`
- `ls -lh pnpm-lock.yaml`

## 12. Cosas que NO se deben hacer todavía
- **NO** implementar lógica de negocio ni endpoints.
- **NO** crear el esquema de Prisma final.
- **NO** implementar autenticación ni servicios de IA.
- **NO** avanzar a la Fase 2 hasta que `pnpm install` sea exitoso y estable.
