# Architecture Overview

## General Architecture
La plataforma sigue un modelo de monorepo basado en Turborepo y pnpm, separando la lógica en aplicaciones independientes y paquetes compartidos.

### Componentes Principales
- **Web (Next.js):** Interfaz de usuario reactiva. No consume APIs de IA directamente; actúa como cliente del API.
- **API (NestJS):** Orquestador de negocio. Gestiona autenticación, validación, guards de tenant y flujo de datos.
- **Worker (NestJS + BullMQ):** Procesa tareas asíncronas, limpieza de datos y exports pesados.
- **Database (PostgreSQL):** Almacenamiento persistente con esquema multi-tenant.
- **Cache/Queue (Redis):** Soporte para BullMQ y sesiones.

## Multi-Tenancy Strategy
El aislamiento se implementa mediante el modelo de **Discriminador de Columna** (`organizationId`).

### Flujo de Aislamiento
1. **AuthGuard:** Valida la identidad del usuario.
2. **TenantGuard:** Valida que el usuario tenga acceso a la `organizationId` solicitada en la petición.
3. **Data Access Layer:** Todos los servicios y repositorios aplican obligatoriamente el filtro `where: { organizationId }`. Se implementará una capa *tenant-aware* (ej. Prisma Extension) para asegurar que ninguna query comercial escape este filtro.

## IA Workflow (Human-in-the-Loop)
La IA opera bajo el principio de "Sugerir, no Ejecutar".
1. **Input:** El usuario proporciona texto.
2. **Processing:** El `AiService` (vía `AiProvider` abstracto) devuelve un JSON estructurado.
3. **Staging:** Los datos se guardan en `AiSuggestion` / `AiExtraction` con estado `PENDING_REVIEW`.
4. **Review:** El usuario edita, acepta o rechaza los datos en la interfaz de revisión.
5. **Commit:** Solo los datos aceptados se mueven a las tablas oficiales del CRM.

## Data Flow
Frontend $\to$ API (Guard $\to$ Service) $\to$ Database / AI Provider / Redis Queue $\to$ Worker $\to$ Database.
