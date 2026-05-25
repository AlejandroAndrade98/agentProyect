# Current Session State: Sales AI Platform

## Estado general

Proyecto: Sales AI Platform, CRM ligero multiempresa con IA human-in-the-loop.

Stack:
- Monorepo con pnpm Workspaces + Turborepo.
- Frontend: Next.js + TypeScript + Tailwind.
- Backend: NestJS + TypeScript.
- Worker: NestJS + BullMQ + Redis.
- DB: PostgreSQL 16.
- ORM: Prisma 5.22.0.
- Infra local: Docker Compose.
- Node 20.
- pnpm 9.0.0.

Reglas centrales:
- No usar SQLite.
- No usar MySQL.
- No usar `latest` en dependencias críticas.
- No usar `prisma db push` como flujo principal.
- Usar Prisma migrations.
- Docker desde el día 1.
- API keys nunca en frontend.
- IA se llama desde backend, nunca desde frontend.
- No avanzar de fase sin aprobación.
- Trabajar paso a paso, con cambios pequeños y revisables.
- No usar `allow all edits`.
- Si hay errores, primero diagnosticar antes de proponer cambios grandes.
- No hacer overwrites completos de archivos importantes sin revisar.

## Reglas multi-tenant

- Toda entidad comercial sensible debe tener `organizationId`.
- Ningún usuario puede consultar datos de otra organización.
- Ningún service comercial debe consultar datos sin filtrar por `organizationId`.
- La protección multi-tenant debe existir en guards/contexto y en la capa de datos/services.
- En la fase actual se usa filtrado explícito en services con `currentUser.organizationId`.
- No implementar Prisma extensions automáticas todavía.

## Reglas de IA human-in-the-loop

La IA no crea datos oficiales automáticamente.

Flujo obligatorio:
1. La IA analiza o sugiere.
2. El usuario revisa.
3. El usuario acepta, edita o rechaza.
4. Solo lo aprobado se convierte en dato oficial.

La IA nunca debe:
- Crear contactos, leads, tareas o notas permanentes sin aprobación.
- Enviar correos sola.
- Borrar datos.

Estados de sugerencias:
- `PENDING_REVIEW`
- `ACCEPTED`
- `EDITED_AND_ACCEPTED`
- `REJECTED`
- `EXPIRED`

Niveles de importancia:
- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

## Fases completadas

- [x] Fase 0: Documentación técnica, visión de producto y ADRs.
- [x] Fase 1: Scaffolding del monorepo.
- [x] Fase 2: Database & Seed con PostgreSQL, Prisma migrations y seed demo.
- [x] Fase 3: Backend Base.
- [x] Fase 4: CRM comercial base.
- [x] Fase 5: Query, Pagination & Filtering.

## Fase 3, Backend Base, resumen

Completado:
- ConfigModule.
- DatabaseModule.
- PrismaService.
- HealthModule.
- Auth Core con login, bcrypt y JWT access token.
- Refresh tokens persistentes, rotación y logout.
- JwtAuthGuard.
- RolesGuard.
- Roles decorator.
- CurrentUser decorator.
- `GET /api/users/me`.
- `GET /api/organizations/current`.

Endpoints base validados:
- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/users/me`
- `GET /api/organizations/current`

Usuario demo local:
- Email: `owner@example.com`
- Password: `dev-password-2026`

## Fase 4, CRM comercial base, resumen

Estado: completada, validada, documentada, commiteada y pusheada.

Módulos completados:
- Companies API.
- Contacts API.
- Products API.
- Leads API.
- Tasks API.
- Notes API.

Endpoints base implementados en cada módulo:
- `GET /api/<resource>`
- `GET /api/<resource>/:id`
- `POST /api/<resource>`
- `PATCH /api/<resource>/:id`
- `DELETE /api/<resource>/:id`

Recursos:
- `companies`
- `contacts`
- `products`
- `leads`
- `tasks`
- `notes`

Reglas validadas:
- JwtAuthGuard en endpoints comerciales.
- `@CurrentUser()`.
- `organizationId` siempre desde token.
- `deletedAt: null` en lecturas.
- Soft delete con `deletedAt`.
- Validación tenant-aware de relaciones.
- ValidationPipe bloquea campos no permitidos como `organizationId` en body.
- Notes usa `createdByUserId` desde usuario autenticado, no desde body.

Smoke test final de Fase 4:
- Companies sin token -> 401.
- Companies con token -> OK.
- Contacts sin token -> 401.
- Contacts con token -> OK.
- Products sin token -> 401.
- Products con token -> OK.
- Leads sin token -> 401.
- Leads con token -> OK.
- Tasks sin token -> 401.
- Tasks con token -> OK.
- Notes sin token -> 401.
- Notes con token -> OK.

## Fase 5, Query, Pagination & Filtering

Estado: completada, validada, commiteada y pusheada.

Objetivo:
- Mejorar endpoints `GET list` para soportar consultas reales de CRM.
- Agregar paginación, búsqueda, filtros y ordenamiento.
- Mantener reglas multi-tenant.
- No tocar schema Prisma.
- No instalar dependencias nuevas.
- No tocar frontend todavía.

Base común creada:
- `apps/api/src/common/dto/pagination-query.dto.ts`
- `apps/api/src/common/utils/pagination.util.ts`

Respuesta estándar:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "total": 0,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}

## Fase 6, Roles & Permissions

Estado: completada, validada en build y validada en runtime.

Objetivo:
- Aplicar control real de permisos por rol en endpoints comerciales.
- Usar `RolesGuard` y `@Roles()` sobre endpoints protegidos.
- Mantener `JwtAuthGuard` como primera capa.
- No modificar schema Prisma.
- No instalar dependencias nuevas.

Archivo creado:
- `apps/api/src/auth/constants/role-groups.ts`

Grupos de roles creados:
- `CRM_READ_ROLES`
- `CRM_WRITE_ROLES`
- `CRM_DELETE_ROLES`
- `PRODUCT_MANAGE_ROLES`

Matriz aplicada:

Products:
- `OWNER`, `ADMIN`, `SUPER_ADMIN`: leer, crear, editar, eliminar.
- `SALES`: solo leer.
- `VIEWER`: solo leer.

Companies, Contacts, Leads, Tasks y Notes:
- `OWNER`, `ADMIN`, `SUPER_ADMIN`: leer, crear, editar, eliminar.
- `SALES`: leer, crear, editar, no eliminar.
- `VIEWER`: solo leer.

Módulos actualizados:
- Products.
- Companies.
- Contacts.
- Leads.
- Tasks.
- Notes.

Validaciones realizadas:
- Products:
  - `OWNER` crea/elimina.
  - `SALES` lee.
  - `SALES` no crea products, devuelve 403.
- Companies:
  - `OWNER` crea/elimina.
  - `SALES` lee/crea.
  - `SALES` no elimina, devuelve 403.
- Contacts:
  - `OWNER` crea/elimina.
  - `SALES` lee/crea.
  - `SALES` no elimina, devuelve 403.
- Leads:
  - `OWNER` crea/elimina.
  - `SALES` lee/crea/edita.
  - `SALES` no elimina, devuelve 403.
- Tasks:
  - `OWNER` crea/elimina.
  - `SALES` lee/crea/edita.
  - `SALES` no elimina, devuelve 403.
- Notes:
  - `OWNER` crea/elimina.
  - `SALES` lee/crea/edita.
  - `SALES` no elimina, devuelve 403.

Smoke test final:
- `OWNER` lee companies, contacts, products, leads, tasks y notes.
- `SALES` lee companies, contacts, products, leads, tasks y notes.
- `SALES` no puede crear products, devuelve 403.
- `VIEWER` lee companies, contacts, products, leads, tasks y notes.
- `VIEWER` no puede crear companies, contacts, products, leads, tasks ni notes, todos devuelven 403.
- Usuario demo restaurado a `OWNER`.

Resultado:
- Fase 6 Roles & Permissions queda cerrada.

## Fase 7, Response Shaping & Relations

Estado: completada, validada en build y validada en runtime.

Objetivo:
- Permitir que endpoints detail devuelvan relaciones controladas mediante query param `include`.
- Evitar respuestas pesadas por defecto.
- Mantener respuesta plana cuando no se pide `include`.
- Ignorar includes no permitidos sin fallar.
- Mantener protección multi-tenant.
- Mantener `JwtAuthGuard`, `RolesGuard` y `@Roles()`.
- No modificar schema Prisma.
- No instalar dependencias nuevas.
- No tocar frontend todavía.

Base común creada:
- `apps/api/src/common/utils/include.util.ts`

Funciones creadas:
- `parseIncludeParam`
- `hasInclude`

Módulos actualizados:
- Companies.
- Contacts.
- Leads.
- Tasks.
- Notes.

DTOs creados:
- `apps/api/src/companies/dto/company-include-query.dto.ts`
- `apps/api/src/contacts/dto/contact-include-query.dto.ts`
- `apps/api/src/leads/dto/lead-include-query.dto.ts`
- `apps/api/src/tasks/dto/task-include-query.dto.ts`
- `apps/api/src/notes/dto/note-include-query.dto.ts`

Includes implementados:

Companies:
- `contacts`
- `leads`
- `notes`, devuelto como `linkedNotes`

Contacts:
- `company`
- `leads`
- `tasks`
- `notes`, devuelto como `linkedNotes`

Leads:
- `company`
- `contact`
- `assignedUser`, devuelto como `user`
- `tasks`
- `notes`, devuelto como `linkedNotes`

Tasks:
- `lead`
- `contact`
- `assignedUser`, devuelto como `user`

Notes:
- `company`
- `contact`
- `lead`
- `createdBy`

Reglas de seguridad:
- Usuarios relacionados se devuelven con `select` seguro.
- `passwordHash` no aparece en respuestas.
- Includes inválidos se ignoran.
- Relaciones de listas usan `take: 20`.
- Relaciones de listas filtran `deletedAt: null`.
- Endpoints detail siguen filtrando por `organizationId` y `deletedAt: null`.

Validación final:
- `pnpm build` exitoso.
- Companies include -> OK.
- Contacts include -> OK.
- Leads include -> OK.
- Tasks include -> OK.
- Notes include -> OK.
- Invalid include ignored -> OK.
- Cleanup temporary task/note -> OK.

Resultado:
- Fase 7 Response Shaping & Relations queda cerrada.

## Fase 8.2, ActivityEventsModule + endpoint read-only

Estado: completada y validada en runtime.

Objetivo:
- Crear endpoint read-only para consultar activity events.
- No crear eventos todavía desde los CRUDs.
- No frontend.
- No IA.
- No integraciones todavía.

Archivos creados:
- `apps/api/src/activity-events/activity-events.module.ts`
- `apps/api/src/activity-events/activity-events.controller.ts`
- `apps/api/src/activity-events/activity-events.service.ts`
- `apps/api/src/activity-events/dto/query-activity-events.dto.ts`

Archivo modificado:
- `apps/api/src/app.module.ts`

Endpoint creado:
- `GET /api/activity-events`

Seguridad:
- Usa `JwtAuthGuard`.
- Usa `RolesGuard`.
- Usa `@Roles(...CRM_READ_ROLES)`.
- Permite lectura a roles CRM read: SUPER_ADMIN, OWNER, ADMIN, SALES, VIEWER.
- Filtra siempre por `organizationId` desde `currentUser`.

Filtros soportados:
- `type`
- `entityType`
- `entityId`
- `source`
- `companyId`
- `contactId`
- `leadId`
- `taskId`
- `noteId`
- `actorUserId`
- `from`
- `to`
- `search`
- `page`
- `pageSize`
- `sortBy`
- `sortOrder`

Includes seguros:
- Incluye `actor` con `select` seguro.
- No expone `passwordHash`.

Aprendizajes:
- `ActivityEventsModule` debe importar `DatabaseModule` para resolver `PrismaService`.
- `ActivityEventsModule` debe importar `AuthModule` para resolver `JwtService` usado por `JwtAuthGuard`.
- TypeScript en VS Code puede quedar cacheado después de `prisma generate`; `TypeScript: Restart TS Server` corrige falsos errores.

Validación runtime:
- `GET /api/activity-events` sin token -> 401.
- `GET /api/activity-events` con token -> OK.
- `GET /api/activity-events?page=1&pageSize=10` -> OK.
- `GET /api/activity-events?type=NOTE_CREATED` -> OK.
- `GET /api/activity-events?type=INVALID` -> 400.
- `GET /api/activity-events?page=0` -> 400.

Resultado:
- Fase 8.2 ActivityEventsModule + endpoint read-only queda cerrada.

## Fase 8.3, ActivityEvents helper + Companies

Estado: validada en runtime.

Cambios:
- ActivityEventsService ahora tiene helper interno para construir y crear eventos.
- CompaniesService crea evento `COMPANY_CREATED` al crear una company.
- Company y ActivityEvent se crean en la misma transaction.
- ActivityEventsModule ya se puede reutilizar desde módulos CRM.

Validación:
- Crear company temporal -> OK.
- Se creó ActivityEvent `COMPANY_CREATED` -> OK.
- Filtro por `companyId` -> OK.
- Filtro por `type=COMPANY_CREATED` -> OK.
- `actor` no expone `passwordHash` -> OK.
- Cleanup de company temporal con soft delete -> OK.

## Fase 8.4, Contacts activity events

Estado: validada en runtime.

Cambios:
- ContactsService crea evento `CONTACT_CREATED` al crear un contact.
- Contact y ActivityEvent se crean en la misma transaction.
- Se conserva validación tenant-aware de `companyId`.

Validación:
- Crear contact temporal -> OK.
- Se creó ActivityEvent `CONTACT_CREATED` -> OK.
- Filtro por `contactId` -> OK.
- Filtro por `type=CONTACT_CREATED` -> OK.
- `actor` no expone `passwordHash` -> OK.
- Cleanup de contact temporal con soft delete -> OK.

## Fase 8.5, Leads activity events

Estado: validada en runtime.

Cambios:
- LeadsService crea evento `LEAD_CREATED` al crear un lead.
- Lead y ActivityEvent se crean en la misma transaction.
- Se conservan validaciones tenant-aware de `companyId`, `contactId` y `assignedToUserId`.

Validación:
- Crear lead temporal -> OK.
- Se creó ActivityEvent `LEAD_CREATED` -> OK.
- Filtro por `leadId` -> OK.
- Filtro por `type=LEAD_CREATED` -> OK.
- `actor` no expone `passwordHash` -> OK.
- Cleanup de lead temporal con soft delete -> OK.

## Fase 8.6, Tasks activity events

Estado: validada en runtime.

Cambios:
- TasksService crea evento `TASK_CREATED` al crear una task.
- Task y ActivityEvent se crean en la misma transaction.
- Se conservan validaciones tenant-aware de `leadId`, `contactId` y `assignedToUserId`.
- `TASK_COMPLETED` queda pendiente para una fase posterior.

Validación:
- Crear task temporal -> OK.
- Se creó ActivityEvent `TASK_CREATED` -> OK.
- Filtro por `taskId` -> OK.
- Filtro por `type=TASK_CREATED` -> OK.
- `actor` no expone `passwordHash` -> OK.
- Cleanup de task temporal con soft delete -> OK.

## Fase 8.7, Notes activity events

Estado: validada en runtime.

Cambios:
- NotesService crea evento `NOTE_CREATED` al crear una note.
- Note y ActivityEvent se crean en la misma transaction.
- Se conservan validaciones tenant-aware de `companyId`, `contactId` y `leadId`.

Validación:
- Crear note temporal -> OK.
- Se creó ActivityEvent `NOTE_CREATED` -> OK.
- Filtro por `noteId` -> OK.
- Filtro por `type=NOTE_CREATED` -> OK.
- `actor` no expone `passwordHash` -> OK.
- Cleanup de note temporal con soft delete -> OK.

## Fase 8.8, Validación final Activity Events

Estado: completada y validada en runtime.

Validación final:
- `pnpm build` -> OK.
- `GET /api/activity-events` sin token -> 401 OK.
- `COMPANY_CREATED` -> OK.
- `CONTACT_CREATED` -> OK.
- `LEAD_CREATED` -> OK.
- `TASK_CREATED` -> OK.
- `NOTE_CREATED` -> OK.
- Actors no exponen `passwordHash` -> OK.
- `type=INVALID` -> 400 OK.
- `page=0` -> 400 OK.
- Cleanup de entidades temporales CRM -> OK.

Resultado:
- Fase 8 Activity Events Foundation queda cerrada.
- ActivityEvent ya sirve como timeline comercial centralizada.
- CRUDs conectados:
  - Companies crea `COMPANY_CREATED`.
  - Contacts crea `CONTACT_CREATED`.
  - Leads crea `LEAD_CREATED`.
  - Tasks crea `TASK_CREATED`.
  - Notes crea `NOTE_CREATED`.
- `TASK_COMPLETED` queda pendiente para fase futura enfocada en cambios de estado/update.

## Fase 9.1, TASK_COMPLETED activity event

Estado: validada en runtime.

Cambios:
- TasksService crea evento `TASK_COMPLETED` cuando una task cambia a `COMPLETED`.
- Si la task ya estaba `COMPLETED`, no duplica el evento.
- Si una task pasa a `COMPLETED`, se setea `completedAt`.
- Si una task sale de `COMPLETED`, se limpia `completedAt`.
- Se conserva actor seguro sin `passwordHash`.

Validación:
- Crear task temporal -> OK.
- PATCH status `COMPLETED` -> `completedAt` set OK.
- ActivityEvent `TASK_COMPLETED` -> OK.
- Repetir PATCH `COMPLETED` -> no duplica OK.
- PATCH status `TODO` -> `completedAt` null OK.
- Cleanup task temporal -> OK.

## Fase 9.2, LEAD_STATUS_CHANGED activity event

Estado: validada en runtime.

Cambios:
- Se agregó `LEAD_STATUS_CHANGED` al enum `ActivityEventType`.
- Migration creada: `20260516185327_add_lead_status_changed_activity_event`.
- LeadsService crea evento `LEAD_STATUS_CHANGED` cuando un lead cambia realmente de status.
- No crea evento si el status enviado es igual al actual.
- No crea evento si el PATCH no incluye `status`.
- `metadataJson` guarda `previousStatus` y `newStatus`.
- Se conserva actor seguro sin `passwordHash`.

Validación:
- Crear lead temporal -> OK.
- PATCH `NEW` a `CONTACTED` -> OK.
- ActivityEvent `LEAD_STATUS_CHANGED` -> OK.
- Metadata `previousStatus/newStatus` -> OK.
- Repetir mismo status -> no duplica OK.
- PATCH sin status -> no crea evento OK.
- Cleanup lead temporal -> OK.

## Fase 9.3, Activity Events for priority/status/assignment changes

Estado: validada en runtime.

Cambios:
- Se agregaron eventos `LEAD_PRIORITY_CHANGED`, `TASK_STATUS_CHANGED` y `TASK_ASSIGNED`.
- LeadsService crea `LEAD_PRIORITY_CHANGED` cuando cambia realmente la prioridad del lead.
- TasksService crea `TASK_STATUS_CHANGED` cuando cambia el status de una task, excepto cuando entra a `COMPLETED`.
- TasksService crea `TASK_ASSIGNED` cuando cambia `assignedToUserId`.
- `TASK_COMPLETED` se mantiene como evento especial para entrada a `COMPLETED`.

Validación:
- `LEAD_PRIORITY_CHANGED` -> OK.
- `TASK_STATUS_CHANGED` -> OK.
- `TASK_ASSIGNED` -> OK.
- `TASK_COMPLETED` no duplicó `TASK_STATUS_CHANGED` -> OK.
- Actores sin `passwordHash` -> OK.
- Cleanup temporal lead/task -> OK.

## Fase 10.1 + 10.2, Dashboard summary

Estado: validada en runtime.

Cambios:
- Se creó `DashboardModule`.
- Se agregó endpoint `GET /api/dashboard/summary`.
- Endpoint protegido con `JwtAuthGuard`, `RolesGuard` y `@Roles(...CRM_READ_ROLES)`.
- Summary devuelve counts de companies, contacts, leads, tasks y activityEvents.
- Todas las queries filtran por `organizationId` y `deletedAt: null` cuando aplica.

Validación:
- `GET /api/dashboard/summary` sin token -> 401.
- `GET /api/dashboard/summary` con token -> OK.
- Shape de respuesta -> OK.
- `pnpm build` -> OK.

## Fase 10.4, Dashboard tasks overview

Estado: validada en runtime.

Cambios:
- Se agregó endpoint `GET /api/dashboard/tasks`.
- El endpoint devuelve `tasksByStatus`, `tasksByPriority`, `pendingTasks`, `overdueTasks`, `dueSoonTasks` y `recentlyCompletedTasks`.
- Todas las queries filtran por `organizationId` y `deletedAt: null`.
- Las relaciones de usuario usan select seguro sin `passwordHash`.

Validación:
- `GET /api/dashboard/tasks` sin token -> 401.
- `GET /api/dashboard/tasks` con token -> OK.
- Shape de respuesta -> OK.
- `passwordHash` oculto -> OK.
- `pnpm build` -> OK.

## Fase 10.5, Dashboard recent activity

Estado: validada en runtime.

Cambios:
- Se agregó endpoint `GET /api/dashboard/recent-activity`.
- Se agregó DTO `QueryDashboardRecentActivityDto`.
- El endpoint devuelve los eventos recientes desde `ActivityEvent`.
- Soporta `limit` entre 1 y 20.
- Soporta filtro por `type`.
- Actor se devuelve con select seguro sin `passwordHash`.

Validación:
- `GET /api/dashboard/recent-activity` sin token -> 401.
- `GET /api/dashboard/recent-activity` con token -> OK.
- Shape de respuesta -> OK.
- `limit=5` -> OK.
- `type=LEAD_CREATED` -> OK.
- `passwordHash` oculto -> OK.
- `pnpm build` -> OK.

## Fase 11.1, Tailwind/env setup

Estado: validada con build.

Cambios:
- Se instaló Tailwind CSS v3 en `@sales-ai/web`.
- Se agregaron `postcss` y `autoprefixer`.
- Se creó `apps/web/tailwind.config.ts`.
- Se creó `apps/web/postcss.config.js`.
- Se creó `apps/web/src/app/globals.css`.
- Se importó `globals.css` en `apps/web/src/app/layout.tsx`.
- Se agregó `NEXT_PUBLIC_API_URL=http://localhost:4000/api` a `.env.example`.
- Se creó `apps/web/.env.local` localmente, sin commitearlo.

Validación:
- `pnpm build` -> OK.

## Fase 11.2, API client + types

Estado: validada con build.

Cambios:
- Se creó la capa de tipos frontend en `apps/web/src/types`.
- Se creó el API client en `apps/web/src/lib/api-client.ts`.
- Se agregaron tipos para auth, user y dashboard.
- `LoginResponse` quedó tipado según la respuesta real de `POST /api/auth/login`.
- El API client usa `NEXT_PUBLIC_API_URL=http://localhost:4000/api`.
- Se agregaron funciones para:
  - `login`
  - `getMe`
  - `getDashboardSummary`
  - `getDashboardLeads`
  - `getDashboardTasks`
  - `getDashboardRecentActivity`

Validación:
- `POST /api/auth/login` devuelve `accessToken`, `refreshToken` y `user`.
- `pnpm build` -> OK.

## Fase 11.3, AuthProvider/useAuth + login page

Estado: validada en runtime.

Cambios:
- Se creó `AuthContext`.
- Se creó hook `useAuth`.
- Se creó `LoginForm`.
- Se creó página `/login`.
- Se actualizó `RootLayout` para envolver la app con `AuthProvider`.
- Se actualizó `/` para redirigir a `/login`.
- Se habilitó CORS en `apps/api/src/main.ts` usando `CORS_ORIGIN`.

Validación:
- `/login` carga correctamente.
- Password incorrecto muestra error.
- Password correcto ejecuta login y redirige a `/dashboard`.
- CORS preflight responde `204` con `Access-Control-Allow-Origin: http://localhost:3000`.
- `pnpm build` -> OK.

Nota:
- `/dashboard` puede responder 404 hasta implementar Fase 11.4.

## Fase 11.4, Protected dashboard layout

Estado: validada en runtime.

Cambios:
- Se creó `/dashboard`.
- Se creó `AuthGuard` client-side.
- Se creó `DashboardLayout` con sidebar, header, usuario actual y logout.
- `/dashboard` queda protegido con sesión validada desde `AuthProvider`.
- Logout limpia tokens y redirige a `/login`.
- Se habilitó CORS en `apps/api/src/main.ts` usando `CORS_ORIGIN`.
- Se confirmó que para correr API desde Windows debe usarse `DATABASE_URL` apuntando a `localhost:15432`.

Validación:
- `/dashboard` sin token -> redirige a `/login`.
- Login correcto -> redirige a `/dashboard`.
- `/dashboard` muestra sidebar/header/layout.
- Logout -> vuelve a `/login`.
- Refresh en `/dashboard` con token guardado -> mantiene sesión.

## Fase 11.5, Dashboard data fetching

Estado: validada en runtime.

Cambios:
- Se creó `DashboardOverview`.
- `/dashboard` consume datos reales usando el API client.
- Se conectaron endpoints:
  - `GET /dashboard/summary`
  - `GET /dashboard/leads`
  - `GET /dashboard/tasks`
  - `GET /dashboard/recent-activity?limit=8`
- Se agregaron estados básicos de loading, error y data.
- Se muestran cards reales y listas básicas.

Validación:
- Login correcto -> `/dashboard`.
- `/dashboard` carga sin error.
- Network muestra requests exitosos a endpoints de dashboard.
- UI muestra datos reales de summary, leads, tasks y recent activity.
- Refresh mantiene sesión y vuelve a cargar datos.

## Fase 11.6, Dashboard UI read-only polish

Estado: validada visualmente.

Cambios:
- Se mejoró visualmente `DashboardOverview`.
- Se agregaron cards más pulidas para métricas principales.
- Se agregaron badges y labels legibles para status, priority y activity events.
- Se agregó sección de recent leads.
- Se mejoró la presentación de recent activity.
- Se mantuvo consumo de datos reales desde la API.
- No se agregó CRUD ni nuevas dependencias.

Validación:
- `/dashboard` carga correctamente.
- Datos reales siguen cargando desde summary, leads, tasks y recent activity.
- UI se ve más profesional y consistente con la paleta slate/navy/blue.

## Fase 11, Frontend Foundation

Estado: completada, validada en runtime y lista para push.

Incluye:
- Tailwind/env setup.
- API client + tipos frontend.
- AuthProvider/useAuth.
- Página `/login`.
- CORS habilitado en API usando `CORS_ORIGIN`.
- `/dashboard` protegido con `AuthGuard`.
- Dashboard layout con sidebar/header/user/logout.
- Dashboard read-only consumiendo endpoints reales:
  - `GET /dashboard/summary`
  - `GET /dashboard/leads`
  - `GET /dashboard/tasks`
  - `GET /dashboard/recent-activity?limit=8`
- UI read-only pulida con paleta slate/navy/blue.

Validación final:
- `pnpm build` -> OK.
- `/login` carga correctamente.
- Password incorrecto muestra `Invalid credentials`.
- Password correcto redirige a `/dashboard`.
- `/dashboard` sin token redirige a `/login`.
- `/dashboard` muestra datos reales.
- Logout funciona.
- Refresh en `/dashboard` mantiene sesión.

## Fase 12, Frontend CRM Management UI

Estado: completada, validada en runtime, documentada localmente y lista para push.

Objetivo:
- Construir la interfaz frontend de gestión CRM sobre los CRUDs existentes del backend.
- Mantener la arquitectura actual sin tocar backend salvo necesidades claras.
- No implementar IA todavía.
- Mantener IA human-in-the-loop para fases futuras.
- Reutilizar la estructura de DashboardLayout, AuthGuard, useAuth y API client creados en Fase 11.

Cambios principales:
- Se corrigió `UserRole` en frontend para alinearlo con backend:
  - `SUPER_ADMIN`
  - `OWNER`
  - `ADMIN`
  - `SALES`
  - `VIEWER`
- Se creó `apps/web/src/types/crm.ts` con tipos frontend para:
  - Companies
  - Contacts
  - Leads
  - Tasks
  - Products
  - Notes
  - Pagination
  - Query params
  - Inputs de create/update
- Se extendió `apps/web/src/lib/api-client.ts` con funciones CRUD para:
  - Companies
  - Contacts
  - Leads
  - Tasks
  - Products
  - Notes
- Se actualizó `DashboardLayout` para activar navegación real hacia:
  - Dashboard
  - Companies
  - Contacts
  - Leads
  - Tasks
  - Products
  - Notes

Módulos frontend implementados:

### Companies UI
- `GET /companies`
- `GET /companies/:id`
- `POST /companies`
- `PATCH /companies/:id`
- `DELETE /companies/:id`
- Páginas:
  - `/dashboard/companies`
  - `/dashboard/companies/new`
  - `/dashboard/companies/[id]`
  - `/dashboard/companies/[id]/edit`
- Componente:
  - `CompanyForm`
- Validado:
  - Listar
  - Crear
  - Ver detalle
  - Editar
  - Eliminar
  - Relaciones en detail con contacts, leads y notes

### Contacts UI
- `GET /contacts`
- `GET /contacts/:id`
- `POST /contacts`
- `PATCH /contacts/:id`
- `DELETE /contacts/:id`
- Páginas:
  - `/dashboard/contacts`
  - `/dashboard/contacts/new`
  - `/dashboard/contacts/[id]`
  - `/dashboard/contacts/[id]/edit`
- Componente:
  - `ContactForm`
- Validado:
  - Listar
  - Crear
  - Ver detalle
  - Editar
  - Eliminar
  - Relación opcional con company
  - LinkedIn opcional funcionando correctamente

### Leads UI
- `GET /leads`
- `GET /leads/:id`
- `POST /leads`
- `PATCH /leads/:id`
- `DELETE /leads/:id`
- Páginas:
  - `/dashboard/leads`
  - `/dashboard/leads/new`
  - `/dashboard/leads/[id]`
  - `/dashboard/leads/[id]/edit`
- Componente:
  - `LeadForm`
- Validado:
  - Listar
  - Crear
  - Ver detalle
  - Editar
  - Eliminar
  - Filtros por status y priority
  - Relaciones con company/contact/assigned user/tasks/notes
  - `Source` corregido para usar enum real del backend:
    - `MANUAL`
    - `AI_SUGGESTION`
    - `IMPORT`
    - `EMAIL`
    - `MEETING`
    - `OTHER`
  - Fechas `expectedCloseDate` y `lastContactAt` convertidas a ISO DateTime antes de enviarse al backend

### Tasks UI
- `GET /tasks`
- `GET /tasks/:id`
- `POST /tasks`
- `PATCH /tasks/:id`
- `DELETE /tasks/:id`
- Páginas:
  - `/dashboard/tasks`
  - `/dashboard/tasks/new`
  - `/dashboard/tasks/[id]`
  - `/dashboard/tasks/[id]/edit`
- Componente:
  - `TaskForm`
- Validado:
  - Listar
  - Crear
  - Ver detalle
  - Editar
  - Eliminar
  - Filtros por status y priority
  - `dueDate` convertido a ISO DateTime antes de enviarse al backend
  - `completedAt` manejado por backend al cambiar status a `COMPLETED`
  - Al salir de `COMPLETED`, backend limpia `completedAt`

### Products UI
- `GET /products`
- `GET /products/:id`
- `POST /products`
- `PATCH /products/:id`
- `DELETE /products/:id`
- Páginas:
  - `/dashboard/products`
  - `/dashboard/products/new`
  - `/dashboard/products/[id]`
  - `/dashboard/products/[id]/edit`
- Componente:
  - `ProductForm`
- Validado:
  - Listar
  - Crear
  - Ver detalle
  - Editar
  - Eliminar
  - Filtro por `isActive`

### Notes UI
- `GET /notes`
- `GET /notes/:id`
- `POST /notes`
- `PATCH /notes/:id`
- `DELETE /notes/:id`
- Páginas:
  - `/dashboard/notes`
  - `/dashboard/notes/new`
  - `/dashboard/notes/[id]`
  - `/dashboard/notes/[id]/edit`
- Componente:
  - `NoteForm`
- Validado:
  - Listar
  - Crear
  - Ver detalle
  - Editar
  - Eliminar
  - Relaciones opcionales con company/contact/lead
  - `createdByUserId` no se envía desde frontend, lo maneja backend desde el usuario autenticado
  - Compatible con flujo futuro de IA human-in-the-loop

Validación final:
- `pnpm build` final pasó:
  - 3 successful
  - 3 total
- Smoke manual final de navegación pasó:
  - `/dashboard`
  - `/dashboard/companies`
  - `/dashboard/contacts`
  - `/dashboard/leads`
  - `/dashboard/tasks`
  - `/dashboard/products`
  - `/dashboard/notes`
- Smoke manual final de relaciones cruzadas pasó.
- CRUD completo validado en runtime para:
  - Companies
  - Contacts
  - Leads
  - Tasks
  - Products
  - Notes

Resultado:
- Fase 12 Frontend CRM Management UI queda completada.
- El frontend ya permite gestionar manualmente el CRM comercial base.
- No se implementó IA todavía.
- La UI queda lista para futuras fases de IA human-in-the-loop, donde la IA sugerirá datos y el usuario decidirá si acepta, edita o rechaza.

## Phase 13A, CRM Frontend Refactor

Status: completed, validated in runtime, committed locally.

This phase focused on reducing duplicated frontend CRM code and making the CRM UI easier to maintain before adding more workflow UX features.

Implemented shared CRM frontend helpers:

- `apps/web/src/lib/formatters.ts`
  - `formatEnumLabel`
  - `formatDate`
  - `formatMoney`

- `apps/web/src/lib/crm-options.ts`
  - shared enum option arrays for importance, priority, source, lead status and task status

- `apps/web/src/lib/crm-styles.ts`
  - shared badge class helpers for importance, priority, lead status, task status and boolean active/inactive states

- `apps/web/src/lib/permissions.ts`
  - shared role-based frontend helpers:
    - `canReadCrm`
    - `canCreateCrm`
    - `canUpdateCrm`
    - `canDeleteCrm`
    - `canManageProducts`

Implemented reusable UI primitives:

- `Badge`
- `EmptyState`
- `ErrorState`
- `LoadingSkeleton`
- `PageHeader`

Refactored CRM frontend resources to use shared helpers and UI primitives:

- Companies
- Contacts
- Leads
- Tasks
- Products
- Notes

Validated behavior:

- CRM list pages still load correctly.
- Search and filters work across refactored resources.
- Detail pages still load correctly.
- Create/edit/delete flows were validated in runtime.
- OWNER permissions still show create/delete/manage actions correctly.
- Shared enum labels and badge styles render correctly.
- Build passed with 3 successful tasks.

Important note:

- This phase intentionally did not introduce backend changes.
- Contextual create flows and Activity Timeline UI are left for the next frontend workflow block.

## Phase 13B, CRM Workflow UX

Status: completed, validated in runtime, committed locally.

This phase focused on improving CRM workflow navigation and contextual creation flows without introducing backend changes.

Implemented contextual CRM create flows:

- Company detail:
  - `New note` opens `/dashboard/notes/new?companyId=...`
  - `New lead` opens `/dashboard/leads/new?companyId=...`

- Contact detail:
  - `New note` opens `/dashboard/notes/new?contactId=...`
  - `New task` opens `/dashboard/tasks/new?contactId=...`
  - `New lead` opens `/dashboard/leads/new?contactId=...&companyId=...` when company is available

- Lead detail:
  - `New note` opens `/dashboard/notes/new?leadId=...`
  - `New task` opens `/dashboard/tasks/new?leadId=...&contactId=...` when contact is available

Updated forms to support contextual query params:

- `LeadForm`
  - supports `companyId`
  - supports `contactId`

- `TaskForm`
  - supports `leadId`
  - supports `contactId`

- `NoteForm`
  - supports `companyId`
  - supports `contactId`
  - supports `leadId`

Implemented Activity Timeline UI:

- Added `apps/web/src/types/activity.ts`
- Added `getActivityEvents` to the frontend API client
- Added `/dashboard/activity`
- Added Activity to the dashboard sidebar
- Activity timeline supports:
  - paginated activity events
  - filter by activity type
  - filter by entity type
  - actor display
  - source display
  - View record navigation

Validation completed:

- Contextual create flows were validated from company, contact and lead detail pages.
- Preselected relations worked correctly in LeadForm, TaskForm and NoteForm.
- Creating contextual notes, leads and tasks worked correctly.
- Activity page loaded successfully.
- Activity filters worked correctly.
- View record worked correctly for active records.
- Activity events pointing to soft-deleted records can show not found in detail pages, which is expected because active CRM detail endpoints filter by `deletedAt: null`.
- Build passed with 3 successful tasks.

Important note:

- This phase intentionally did not introduce backend changes.
- ActivityEvent types were kept in a dedicated frontend type file instead of expanding `crm.ts`.

## Phase 13C, Frontend API and Types Modularization

Status: completed, validated in runtime, committed and pushed.

This phase focused on improving frontend maintainability by splitting large API and CRM type files into smaller resource-based modules without changing runtime behavior.

Implemented API client modularization:

- Extracted API core to `apps/web/src/lib/api/core.ts`
  - `API_BASE_URL`
  - `ApiClientError`
  - `apiRequest`
  - request URL/query handling

- Split API resource functions under `apps/web/src/lib/api/`
  - `auth.ts`
  - `dashboard.ts`
  - `companies.ts`
  - `contacts.ts`
  - `leads.ts`
  - `tasks.ts`
  - `products.ts`
  - `notes.ts`
  - `activity-events.ts`

- Kept `apps/web/src/lib/api-client.ts` as a barrel export so existing imports continue working.

Implemented CRM types modularization:

- Kept `apps/web/src/types/crm.ts` as a barrel export.
- Moved CRM types into `apps/web/src/types/crm/`
  - `common.ts`
  - `companies.ts`
  - `contacts.ts`
  - `leads.ts`
  - `tasks.ts`
  - `products.ts`
  - `notes.ts`
  - `index.ts`

- Kept Activity Timeline types in dedicated file:
  - `apps/web/src/types/activity.ts`

Validation completed:

- Login worked correctly.
- Dashboard routes loaded correctly.
- Companies, Contacts, Leads, Tasks, Products, Notes and Activity pages loaded correctly.
- Build passed with 3 successful tasks.

Important note:

- This phase did not introduce new product behavior.
- Existing imports from `@/lib/api-client` and `@/types/crm` were preserved through barrel exports.

## Phase 13D, CRM Boards & Workflow Foundation

Status: completed, validated in runtime, committed locally.

This phase added a professional CRM board workflow foundation for leads and tasks, including backend board fields, workflow endpoints, frontend board views, quick status updates, and Activity Timeline integration.

Backend and database foundation:

- Added board workflow fields to Prisma:
  - Lead `pipelinePosition`
  - Lead `statusChangedAt`
  - Task `boardPosition`
  - Task `statusChangedAt`

- Added Prisma migration:
  - `20260521224249_add_crm_board_workflow_fields`

- Added root database scripts:
  - `db:migrate`
  - `db:generate`
  - `db:studio`
  - `db:deploy`

- Added `scripts/prisma-host.mjs` to run Prisma commands from Windows using `DATABASE_URL_HOST` as `DATABASE_URL`.

Backend API additions:

- Added `MoveLeadPipelineDto`
- Added `MoveTaskBoardDto`

- Added endpoint:
  - `PATCH /api/leads/:id/pipeline`

- Added endpoint:
  - `PATCH /api/tasks/:id/board`

Backend behavior:

- Moving a lead updates:
  - `status`
  - `pipelinePosition`
  - `statusChangedAt`

- Moving a task updates:
  - `status`
  - `boardPosition`
  - `statusChangedAt`

- Moving a task to `COMPLETED` also sets:
  - `completedAt`

- Moving a task out of `COMPLETED` clears:
  - `completedAt`

Activity Events validation:

- Lead board moves create `LEAD_STATUS_CHANGED` events when status changes.
- Task board moves create `TASK_STATUS_CHANGED` events when status changes.
- Task moves to `COMPLETED` create `TASK_COMPLETED` events.
- Activity metadata includes previous and new status plus previous and new board/pipeline position.

Frontend board experience:

- Added Lead Pipeline view:
  - `/dashboard/leads/pipeline`

- Added Tasks Board view:
  - `/dashboard/tasks/board`

- Added quick status updates from cards.
- Added board navigation buttons from:
  - Leads list to Pipeline view
  - Tasks list to Board view

- Added frontend API client functions:
  - `moveLeadPipeline`
  - `moveTaskBoard`

- Updated frontend CRM types:
  - Lead `pipelinePosition`
  - Lead `statusChangedAt`
  - Task `boardPosition`
  - Task `statusChangedAt`

Activity Timeline polish:

- Added `formatDateTime`
- Activity Timeline now shows date and time for events.

Validation completed:

- Prisma migration applied successfully.
- Prisma Client generated successfully.
- `pnpm build` passed with 3 successful tasks.
- `PATCH /api/leads/:id/pipeline` validated in runtime.
- `PATCH /api/tasks/:id/board` validated in runtime.
- Both endpoints return 401 without token.
- Activity events were generated correctly for lead and task board moves.
- Lead Pipeline UI validated from the frontend.
- Tasks Board UI validated from the frontend.
- Quick status updates worked from the frontend.
- Activity Timeline reflected board changes correctly.

## Phase 14A, AI Suggestion Foundation

Status: completed, validated in runtime, committed locally.

This phase introduced the first structured AI foundation for the Sales AI Platform. The goal was to add AI-generated CRM suggestions while preserving the project's human-in-the-loop rule: AI can suggest, but it cannot apply official CRM changes or send emails automatically.

Core rules preserved:

- AI suggestions are review-only by default.
- AI cannot update CRM records automatically.
- AI cannot create tasks, notes, contacts, leads, or companies automatically.
- AI cannot send emails automatically.
- A human must review and approve any future CRM action before it becomes official.

Database foundation:

- Extended `AiSuggestion` to support contextual CRM suggestions:
  - `title`
  - `entityType`
  - `entityId`
  - `companyId`
  - `contactId`
  - `leadId`
  - `taskId`
  - `noteId`
  - `confidenceScore`
  - `metadataJson`

- Added contextual indexes for AI suggestions:
  - `organizationId + entityType + entityId`
  - `organizationId + leadId`
  - `organizationId + companyId`
  - `organizationId + contactId`
  - `organizationId + taskId`
  - `organizationId + noteId`

- Added ActivityEvent types:
  - `AI_SUGGESTION_CREATED`
  - `AI_SUGGESTION_ACCEPTED`
  - `AI_SUGGESTION_REJECTED`

- Added Prisma migration:
  - `add_ai_suggestion_context_fields`

Backend AI Suggestion module:

- Created `AiSuggestionsModule`.
- Created `AiSuggestionsController`.
- Created `AiSuggestionsService`.
- Created `QueryAiSuggestionsDto`.
- Created `LeadAiContextService`.
- Created `AiSuggestionProviderService` using a mock provider.

Backend endpoints added:

- `POST /api/ai-suggestions/leads/:leadId/next-steps`
- `GET /api/ai-suggestions`
- `GET /api/ai-suggestions/:id`

First AI use case:

- Generate next-step suggestions for a lead.
- Context includes:
  - Lead data
  - Company data
  - Contact data
  - Assigned user
  - Related tasks
  - Related notes
  - Recent lead activity events

Generated suggestion behavior:

- Creates an `AiSuggestion` with:
  - `type = SUGGEST_NEXT_STEPS`
  - `status = PENDING_REVIEW`
  - `entityType = LEAD`
  - `leadId`
  - `confidenceScore`
  - `outputJson`
  - `outputText`
  - `metadataJson`

- Metadata explicitly includes:
  - `humanApprovalRequired = true`
  - `canApplyAutomatically = false`
  - `canSendEmailAutomatically = false`

Activity Events integration:

- Creating an AI suggestion creates an `AI_SUGGESTION_CREATED` ActivityEvent.
- Activity event metadata includes:
  - `aiSuggestionId`
  - `aiSuggestionType`
  - `aiSuggestionStatus`
  - `humanApprovalRequired`
  - `canApplyAutomatically`
  - `canSendEmailAutomatically`

Frontend AI Suggestions Review UI:

- Added frontend AI suggestion types:
  - `apps/web/src/types/ai-suggestions.ts`

- Added frontend API functions:
  - `getAiSuggestions`
  - `getAiSuggestion`
  - `generateLeadNextStepsSuggestion`

- Added AI Suggestions global page:
  - `/dashboard/ai-suggestions`

- Added AI Suggestion detail page:
  - `/dashboard/ai-suggestions/:id`

- Added AI Suggestions sidebar navigation:
  - `apps/web/src/components/DashboardLayout.tsx`

- Added Lead Detail AI Review panel:
  - `apps/web/src/app/dashboard/leads/[id]/LeadAiSuggestionsPanel.tsx`

Lead Detail AI Review behavior:

- Shows recent AI suggestions for the lead.
- Allows generating a new `SUGGEST_NEXT_STEPS` suggestion.
- Shows status, confidence, created date and preview.
- Provides Review and View all actions.
- Does not apply suggestions to CRM records.

AI Suggestion detail behavior:

- Shows output text.
- Shows structured recommendation:
  - summary
  - recommended next step
  - suggested note
  - suggested tasks
  - reasoning summary

- Shows suggestion metadata:
  - created date
  - expiration date
  - provider
  - model
  - token counts
  - estimated cost

- Shows safety flags:
  - human approval required
  - can apply automatically
  - can send email automatically

Validation completed:

- Prisma migration applied successfully.
- Prisma Client generated successfully.
- `pnpm build` passed with 3 successful tasks.
- `POST /api/ai-suggestions/leads/:leadId/next-steps` validated in runtime.
- `GET /api/ai-suggestions` validated in runtime.
- `GET /api/ai-suggestions/:id` validated in runtime.
- AI suggestions are created as `PENDING_REVIEW`.
- AI suggestions are linked to the correct lead.
- `AI_SUGGESTION_CREATED` ActivityEvent is generated correctly.
- Endpoint without token returns 401.
- `/dashboard/ai-suggestions` validated from frontend.
- `/dashboard/ai-suggestions/:id` validated from frontend.
- Lead Detail AI Review panel validated from frontend.
- Suggest next steps button generates new suggestions.
- Review opens suggestion detail.
- View all opens AI Suggestions list.
- Safety flags display correctly.

## Phase 14B, AI Suggestion Review Actions

Status: completed, validated in runtime, committed locally.

This phase added human review actions for AI suggestions. The goal was to allow users to accept or reject an AI-generated suggestion while still preserving the human-in-the-loop rule: accepting a suggestion does not apply CRM changes automatically.

Core rules preserved:

- Accepting an AI suggestion does not update CRM records.
- Rejecting an AI suggestion does not update CRM records.
- AI cannot create tasks, notes, contacts, leads, companies, or emails automatically.
- AI cannot send emails automatically.
- Every reviewed suggestion stores who reviewed it and when it was reviewed.
- ActivityEvents are created for accepted and rejected suggestions.

Backend review actions:

- Added `ReviewAiSuggestionDto`.
- Added endpoint:
  - `PATCH /api/ai-suggestions/:id/accept`
- Added endpoint:
  - `PATCH /api/ai-suggestions/:id/reject`

Backend behavior:

- Only `PENDING_REVIEW` suggestions can be reviewed.
- Accepting a suggestion changes status to `ACCEPTED`.
- Rejecting a suggestion changes status to `REJECTED`.
- Reviewed suggestions store:
  - `reviewedByUserId`
  - `reviewedAt`
  - review metadata in `metadataJson`

- Attempting to review the same suggestion twice returns `409`.
- Reviewing without token returns `401`.

Activity Events integration:

- Accepting a suggestion creates:
  - `AI_SUGGESTION_ACCEPTED`

- Rejecting a suggestion creates:
  - `AI_SUGGESTION_REJECTED`

- Activity metadata includes:
  - `aiSuggestionId`
  - `aiSuggestionType`
  - previous status
  - new status
  - review note
  - `humanApprovalRequired = true`
  - `appliedToCrm = false`
  - `canApplyAutomatically = false`
  - `canSendEmailAutomatically = false`

Frontend review actions:

- Added frontend type:
  - `ReviewAiSuggestionInput`

- Added frontend API functions:
  - `acceptAiSuggestion`
  - `rejectAiSuggestion`

- Updated AI Suggestion detail page:
  - Review note input
  - Accept review button
  - Reject suggestion button
  - Success messages
  - Reviewed at display
  - Reviewed by display
  - Reviewed suggestions no longer show review action buttons

Frontend behavior:

- Accepting a suggestion updates the status visually to `ACCEPTED`.
- Rejecting a suggestion updates the status visually to `REJECTED`.
- Review actions show that no CRM changes were applied automatically.
- Safety flags remain visible:
  - human approval required
  - cannot apply automatically
  - cannot send email automatically

Validation completed:

- `pnpm build` passed with 3 successful tasks.
- Accept suggestion validated in runtime.
- Reject suggestion validated in runtime.
- `AI_SUGGESTION_ACCEPTED` ActivityEvent validated.
- `AI_SUGGESTION_REJECTED` ActivityEvent validated.
- Duplicate review attempt returned `409`.
- Review without token returned `401`.
- Frontend Accept review flow validated.
- Frontend Reject suggestion flow validated.
- Reviewed status updates correctly in the UI.
- Reviewed at and reviewed by display correctly.
- Activity Timeline shows accepted and rejected AI suggestion events.

Important note:

- This phase intentionally does not apply AI suggestions to CRM records.
- Applying AI suggestions to Lead next step, Tasks, or Notes is reserved for a future phase.


## Phase 14C, Apply AI Suggestions

Status: completed, validated in runtime, committed locally.

This phase added controlled application actions for accepted AI suggestions. The goal was to let a human explicitly convert reviewed AI recommendations into official CRM data while preserving the human-in-the-loop rule.

Core rules preserved:

- AI does not apply CRM changes automatically.
- Accepting a suggestion does not apply CRM changes.
- Applying a suggestion requires a separate explicit human action.
- AI cannot send emails automatically.
- Every applied action is recorded through ActivityEvents.
- Rejected, expired or pending suggestions cannot be applied.

Backend apply foundation:

- Added ActivityEvent type:
  - `AI_SUGGESTION_APPLIED`

- Added Prisma migration:
  - `add_ai_suggestion_applied_activity_event`

- Added DTOs:
  - `ApplyLeadNextStepDto`
  - `ApplySuggestedTaskDto`
  - `ApplySuggestedNoteDto`

Backend endpoints added:

- `PATCH /api/ai-suggestions/:id/apply/lead-next-step`
- `POST /api/ai-suggestions/:id/apply/task`
- `POST /api/ai-suggestions/:id/apply/note`

Backend behavior:

- Only `ACCEPTED` or `EDITED_AND_ACCEPTED` suggestions can be applied.
- `PENDING_REVIEW`, `REJECTED` and `EXPIRED` suggestions cannot be applied.
- Applying lead next step updates:
  - `Lead.nextStep`

- Creating a task from suggestion creates an official Task linked to the lead.
- Creating a note from suggestion creates an official Note linked to the lead.
- Suggested task and note values can be overridden by the human before applying.
- Applied actions update `AiSuggestion.metadataJson.appliedActions`.
- Already applied actions cannot be applied again.

Activity Events integration:

- Applying lead next step creates:
  - `AI_SUGGESTION_APPLIED`

- Creating a task from an AI suggestion creates:
  - `TASK_CREATED`
  - `AI_SUGGESTION_APPLIED`

- Creating a note from an AI suggestion creates:
  - `NOTE_CREATED`
  - `AI_SUGGESTION_APPLIED`

Activity metadata includes:

- `aiSuggestionId`
- `aiSuggestionType`
- `appliedAction`
- `appliedToCrm = true`
- `canApplyAutomatically = false`
- `canSendEmailAutomatically = false`

Frontend apply actions:

- Added frontend apply types:
  - `ApplyLeadNextStepInput`
  - `ApplySuggestedTaskInput`
  - `ApplySuggestedNoteInput`

- Added frontend API functions:
  - `applyAiSuggestionLeadNextStep`
  - `applyAiSuggestionTask`
  - `applyAiSuggestionNote`

- Updated AI Suggestion detail page:
  - Apply recommended next step
  - Create suggested task
  - Create suggested note
  - Editable values before applying
  - Applied badges
  - Disabled fields after applying
  - Success messages after each action

Validation completed:

- `pnpm build` passed with 3 successful tasks.
- Accepted suggestion allowed applying lead next step.
- Lead `nextStep` updated correctly.
- Accepted suggestion allowed creating a task.
- Created task has status `TODO` and correct `leadId`.
- Accepted suggestion allowed creating a note.
- Created note has source `AI_SUGGESTION` and correct `leadId`.
- `AI_SUGGESTION_APPLIED` ActivityEvents created for next step, task and note.
- Rejected suggestion cannot be applied and returns `409`.
- Frontend apply actions validated visually.
- Applied actions show `Applied` status and cannot be repeated.
- Safety rule preserved: no email is sent automatically.

## Phase 14D, AI Usage Governance Foundation

Status: completed, validated in runtime, committed and pushed.

This phase added AI usage governance, credit tracking, user limits, organization limits, usage reporting endpoints, and a frontend AI Usage dashboard under Settings.

Core business rules:

- AI usage is controlled by organization-level credits.
- Each organization has an AI credit balance.
- Each organization has a monthly AI credit limit.
- Each user has a personal monthly AI credit limit.
- If a user has no custom limit, the organization default user limit is used.
- One user cannot consume the entire organization pool without limits.
- AI usage is blocked before generation when limits are exceeded.
- Blocked attempts are recorded for audit.
- AI usage does not send emails automatically.
- AI suggestions remain human-in-the-loop.

Database changes:

- Replaced `UsageRecord` with `OrganizationUsageSummary`.
- Added AI-specific usage models:
  - `AiUsageRecord`
  - `AiCreditTransaction`
  - `AiUserUsageLimit`

- Added AI governance fields to `Organization`:
  - `aiEnabled`
  - `aiMonthlyCreditsLimit`
  - `aiDefaultUserMonthlyCreditsLimit`
  - `aiCreditsBalance`
  - `aiCreditsUpdatedAt`

- Added enums:
  - `AiUsageFeature`
  - `AiUsageStatus`
  - `AiCreditTransactionType`

- Applied migrations:
  - `add_ai_usage_governance`
  - `adjust_ai_usage_default_credit_limits`

AI credit defaults:

- Organization monthly credits limit: `5,000,000`
- Default user monthly credits limit: `1,000,000`
- Organization starting credits balance: `5,000,000`

Backend services:

- Added `AiUsageModule`.
- Added `AiUsageService`.
- Integrated usage governance into `generateLeadNextSteps`.

Backend behavior:

- Before generating an AI suggestion:
  - validates organization AI is enabled
  - validates organization credit balance
  - validates organization monthly limit
  - validates user monthly limit

- After successful AI usage:
  - creates `AiUsageRecord`
  - decrements `Organization.aiCreditsBalance`
  - creates `AiCreditTransaction` with `USAGE_DEBIT`

- Blocked usage creates `AiUsageRecord` with status `BLOCKED`.

Backend endpoints:

- `GET /api/ai-usage/me`
- `GET /api/ai-usage/organization`
- `GET /api/ai-usage/records`

Authorization behavior:

- All authenticated CRM users can view personal AI usage.
- `OWNER`, `ADMIN`, and `SUPER_ADMIN` can view organization AI usage.
- Usage records are tenant-aware.
- Non-admin users only see their own usage records.

Frontend:

- Added AI usage types:
  - `apps/web/src/types/ai-usage.ts`

- Added API client functions:
  - `getMyAiUsage`
  - `getOrganizationAiUsage`
  - `getAiUsageRecords`

- Added Settings page:
  - `/dashboard/settings`

- Added AI Usage page:
  - `/dashboard/settings/ai-usage`

- Added Settings navigation to sidebar.

AI Usage UI shows:

- Personal monthly credits used.
- Personal credits remaining.
- Personal AI request count.
- Organization credit balance.
- Organization monthly usage.
- Organization estimated provider cost.
- Usage by feature.
- Usage by user.
- Usage history records.
- `SUCCESS`, `FAILED`, and `BLOCKED` statuses.

Validation completed:

- Prisma format passed.
- Prisma migrations applied successfully.
- Prisma Client generated successfully.
- `pnpm build` passed with 3 successful tasks.
- AI suggestion generation creates `AiUsageRecord`.
- AI suggestion generation creates `AiCreditTransaction`.
- Organization credit balance decreases after successful usage.
- Blocked AI attempts are recorded.
- `GET /api/ai-usage/me` validated in runtime.
- `GET /api/ai-usage/organization` validated in runtime.
- `GET /api/ai-usage/records` validated in runtime.
- Unauthorized request returns 401.
- Settings UI validated.
- AI Usage UI validated.
- Usage records display `SUCCESS` and `BLOCKED`.

## Phase 15A, Platform Account & Organization Management Foundation

Status: completed, validated in runtime, documented, committed and pushed.

This phase converted the project into a stronger SaaS platform foundation with platform-level account management, tenant organization settings, user visibility, and a dedicated internal SUPER_ADMIN workspace.

Core platform decisions:

- Every customer account is represented as an `Organization`.
- Individual accounts are modeled as organizations with `accountType = INDIVIDUAL`.
- Company accounts are modeled as organizations with `accountType = COMPANY`.
- `SUPER_ADMIN` manages organizations globally through Platform Admin.
- `OWNER` and `ADMIN` manage only their own organization through Organization Settings.
- Settings represents the current user's own organization, not global platform administration.
- Platform Admin is the correct place for global cross-organization administration.
- Gmail/Outlook integration and real AI provider integration were intentionally deferred until after account and organization management are solid.

Database changes:

- Added enums:
  - `OrganizationAccountType`
  - `OrganizationStatus`
  - `OrganizationInvitationStatus`

- Added organization account management fields:
  - `accountType`
  - `status`
  - `billingEmail`
  - `supportEmail`
  - `timezone`
  - `locale`
  - `statusReason`
  - `trialEndsAt`
  - `activatedAt`
  - `suspendedAt`
  - `cancelledAt`

- Added `OrganizationInvitation` model with:
  - `organizationId`
  - `email`
  - `role`
  - `status`
  - `tokenHash`
  - `invitedByUserId`
  - `acceptedByUserId`
  - `expiresAt`
  - `acceptedAt`
  - `revokedAt`

- Added invitation relations to `Organization` and `User`.

Backend Platform Admin:

- Added `PlatformModule`.
- Added `PlatformOrganizationsController`.
- Added `PlatformOrganizationsService`.
- Added DTOs:
  - `QueryPlatformOrganizationsDto`
  - `UpdatePlatformOrganizationDto`
  - `UpdatePlatformOrganizationStatusDto`

Platform Admin endpoints:

- `GET /api/platform/organizations`
- `GET /api/platform/organizations/:id`
- `PATCH /api/platform/organizations/:id`
- `PATCH /api/platform/organizations/:id/status`

Authorization behavior:

- Platform Admin endpoints are restricted to `SUPER_ADMIN`.
- `OWNER` receives 403 when accessing platform organization routes.
- `SUPER_ADMIN` can list organizations globally.
- `SUPER_ADMIN` can view organization details globally.
- `SUPER_ADMIN` can update account settings, limits, credits, and status globally.
- Nonexistent organization returns 404.

Backend Organization Settings:

- Added `OrganizationSettingsModule`.
- Added `OrganizationSettingsController`.
- Added `OrganizationSettingsService`.
- Added DTOs:
  - `UpdateCurrentOrganizationDto`
  - `QueryOrganizationUsersDto`

Organization Settings endpoints:

- `GET /api/organization/current`
- `PATCH /api/organization/current`
- `GET /api/organization/users`

Authorization behavior:

- Authenticated CRM users can view their current organization.
- `OWNER`, `ADMIN`, and `SUPER_ADMIN` can update their own organization settings.
- `OWNER`, `ADMIN`, and `SUPER_ADMIN` can view users from their own organization.
- `SALES` and `VIEWER` cannot access organization users.
- `OWNER` and `ADMIN` cannot query `role=SUPER_ADMIN`.
- `SUPER_ADMIN` can see `SUPER_ADMIN` users only within the current organization from Settings.
- Global user administration is intentionally reserved for a future `/dashboard/platform/users`.

Frontend Platform Admin:

- Added platform types:
  - `apps/web/src/types/platform.ts`

- Added platform API client:
  - `apps/web/src/lib/api/platform.ts`

- Added routes:
  - `/dashboard/platform/organizations`
  - `/dashboard/platform/organizations/:id`

- Added Platform navigation item visible only to `SUPER_ADMIN`.

Platform UI features:

- List organizations globally.
- Filter by search, status, and account type.
- Show account type, status, plan, users, leads, AI usage records, and AI credits.
- Show primary admin using `OWNER` or `SUPER_ADMIN`.
- View organization detail.
- Edit account settings.
- Edit status and status reason.
- View users and invitations for an organization.

Frontend Organization Settings:

- Added organization settings types:
  - `apps/web/src/types/organization-settings.ts`

- Added organization settings API client:
  - `apps/web/src/lib/api/organization-settings.ts`

- Updated Settings page with:
  - Organization
  - Users
  - AI Usage
  - Appearance, coming soon
  - Language, coming soon

- Added routes:
  - `/dashboard/settings/organization`
  - `/dashboard/settings/users`

Organization Settings UI features:

- Show current organization profile.
- Show account type, status, plan, billing email, support email, timezone, locale.
- Show organization counts.
- Edit name, industry, billing email, support email, timezone, and locale.
- Show users in the current organization.
- Filter users by search, role, and active status.
- Hide Users card for roles that cannot manage users.
- Hide `SUPER_ADMIN` role filter for non-SUPER_ADMIN users.

Dev seed updates:

- Updated `packages/database/prisma/seed.ts` to match the current schema.
- Removed old fields:
  - `maxAiRequestsPerMonth`
  - `maxStorageMb`

- Seed now creates:
  - `Demo Organization`
  - `owner@example.com` as `OWNER`
  - `Sales AI Platform Admin`
  - `alejandro21112@hotmail.com` as `SUPER_ADMIN`
  - Demo products

- Dev login:
  - `owner@example.com`
  - `alejandro21112@hotmail.com`
  - Both use the existing dev password: `dev-password-2026`

Validation completed:

- Prisma migration applied successfully.
- Prisma generate passed.
- Seed passed successfully.
- Build passed with 3 successful tasks.
- `OWNER` cannot access Platform Admin routes.
- `SUPER_ADMIN` can access Platform Admin routes.
- `SUPER_ADMIN` can list and edit organizations globally.
- `OWNER` can access current organization settings.
- `OWNER` can update own organization settings.
- `OWNER` can view organization users.
- `OWNER` receives 403 when querying `role=SUPER_ADMIN`.
- `SUPER_ADMIN` has a dedicated internal organization.
- `SUPER_ADMIN` sees Platform navigation.
- `OWNER` does not see Platform navigation.
- `/dashboard/platform/organizations` validated.
- `/dashboard/platform/organizations/:id` validated.
- `/dashboard/settings` validated.
- `/dashboard/settings/organization` validated.
- `/dashboard/settings/users` validated.

## Phase 15B, Organization Invitations & User Access Management

Status: completed, validated in runtime, documented, committed and pushed.

This phase added organization-level invitation flows, public invitation acceptance, user activation controls, and real organization status access enforcement.

Core decisions:

- Users are not created directly from Organization Settings.
- Users are created when an invited person accepts an invitation.
- Invitations are tenant-aware and belong to one organization.
- User deletion is not hard delete.
- User access is controlled with `User.isActive`.
- Organization-level access is controlled with `Organization.status`.
- Settings represents the current user's own organization.
- Platform Admin remains the global cross-organization administration layer.

Invitation management backend:

- Added DTOs:
  - `CreateOrganizationInvitationDto`
  - `QueryOrganizationInvitationsDto`
  - `AcceptOrganizationInvitationDto`

- Added protected organization invitation endpoints:
  - `GET /api/organization/invitations`
  - `POST /api/organization/invitations`
  - `PATCH /api/organization/invitations/:id/revoke`

- Added public invitation acceptance endpoints:
  - `GET /api/organization/invitations/accept/:token`
  - `POST /api/organization/invitations/accept`

Invitation rules:

- `OWNER` can invite `ADMIN`, `SALES`, and `VIEWER`.
- `ADMIN` can invite `SALES` and `VIEWER`.
- `SUPER_ADMIN` can invite `OWNER`, `ADMIN`, `SALES`, and `VIEWER` inside their current organization.
- `SUPER_ADMIN` cannot be invited from Organization Settings.
- `SALES` and `VIEWER` cannot invite users.
- Duplicate pending invitations are blocked.
- Existing users cannot be invited again.
- Pending invitations can be revoked.
- Accepted, revoked, and expired invitations cannot be reused.
- Invitations respect `Organization.maxUsers`.

Invitation acceptance:

- Public invitation preview returns organization, email, role, status, and expiration.
- Accepting an invitation creates a real `User`.
- Passwords are hashed with bcrypt.
- The invitation is marked as `ACCEPTED`.
- `acceptedAt` and `acceptedByUserId` are stored.
- Accepted users can log in normally.
- Reusing an accepted token returns an error.
- Expired invitations are marked as `EXPIRED`.

Frontend invitation admin UI:

- Updated `/dashboard/settings/users`.
- Added invite user form.
- Added role selection based on current user role.
- Added invitation list.
- Added invitation status filters.
- Added status badges for `PENDING`, `ACCEPTED`, `REVOKED`, and `EXPIRED`.
- Added revoke action for pending invitations.
- Temporarily displays the acceptance token only in development after creating an invitation.
- Token can be hidden manually and is cleared when the invitation is revoked.

Frontend public invitation acceptance UI:

- Added route:
  - `/accept-invitation/:token`

- Public page shows:
  - Organization
  - Invited email
  - Assigned role
  - Expiration date

- Public page allows:
  - Entering name
  - Entering password
  - Confirming password
  - Accepting invitation
  - Going to login after success

- Form errors are separated from invitation loading errors.
- Password mismatch stays inside the form and allows retry.
- Invalid, revoked, expired, or accepted tokens show an unavailable invitation state.

User access management backend:

- Added endpoints:
  - `PATCH /api/organization/users/:id/deactivate`
  - `PATCH /api/organization/users/:id/reactivate`

User access rules:

- Users are deactivated with `isActive = false`.
- Users are reactivated with `isActive = true`.
- No hard delete is performed.
- Deactivated users cannot log in.
- Reactivated users can log in again.
- Reactivation respects `Organization.maxUsers`.
- Users cannot deactivate themselves.
- `OWNER` can manage `ADMIN`, `SALES`, and `VIEWER`.
- `ADMIN` can manage `SALES` and `VIEWER`.
- `OWNER` and `ADMIN` cannot manage `SUPER_ADMIN`.
- `SALES` and `VIEWER` cannot manage users.

Frontend user access management UI:

- Added Deactivate button for manageable active users.
- Added Reactivate button for manageable inactive users.
- Self-management actions are hidden.
- Unauthorized role actions are hidden.
- User list refreshes after activation status changes.
- Success and error messages are shown in Settings Users.

Organization status access enforcement:

- `Organization.status` is now enforced in backend access.
- `TRIAL` and `ACTIVE` organizations can access the platform.
- `SUSPENDED` organizations are blocked.
- `CANCELLED` organizations are blocked.
- Login is blocked for users in suspended or cancelled organizations.
- Refresh token flow is blocked for suspended or cancelled organizations.
- Existing access tokens are blocked by `JwtAuthGuard` when organization status changes.
- Invitation preview and acceptance are blocked for suspended or cancelled organizations.
- `SUPER_ADMIN` can restore the organization from Platform Admin.

Security improvements:

- `JwtAuthGuard` now checks the current user and organization from the database.
- Existing tokens no longer rely only on stale JWT role/status data.
- Inactive users are rejected by protected endpoints.
- Suspended/cancelled organizations are rejected by protected endpoints.

Runtime validation completed:

- Owner created invitation successfully.
- Owner could not invite `SUPER_ADMIN`.
- Invitation list returned paginated results.
- Pending invitation could be revoked.
- Public invitation preview worked.
- Public invitation acceptance created user.
- Accepted invitation became `ACCEPTED`.
- New invited user could log in.
- Reusing accepted invitation returned error.
- Password mismatch stayed inside the form and allowed retry.
- Owner could deactivate a `SALES` user.
- Deactivated user login returned 401.
- Owner could reactivate the `SALES` user.
- Reactivated user could log in again.
- Owner could not deactivate themselves.
- Suspended organization blocked login with 403.
- Suspended organization blocked old access tokens with 403.
- Restoring organization to `TRIAL` restored access.
- Build passed with 3 successful tasks.

## Phase 15C, Platform Owner Onboarding

Status: completed, validated in runtime, documented, committed and pushed.

This phase completed the SaaS onboarding flow where a `SUPER_ADMIN` can create a customer organization and generate the first `OWNER` invitation.

Core flow:

- `SUPER_ADMIN` creates a new customer organization from Platform Admin.
- The backend creates the organization and an initial `OWNER` invitation.
- The development response includes a temporary acceptance token.
- The invited owner accepts the invitation from the public acceptance page.
- The accepted owner can log in and access their own organization.
- The owner can then invite their team from Organization Settings.

Backend:

- Added DTO:
  - `OnboardPlatformOrganizationDto`
  - `CreatePlatformOwnerInvitationDto`

- Added endpoint:
  - `POST /api/platform/organizations/onboard`

- The onboarding endpoint:
  - Creates a new organization.
  - Creates an initial pending `OWNER` invitation.
  - Blocks duplicate organization slugs.
  - Blocks owner emails already used by existing users.
  - Blocks owner emails with active pending invitations.
  - Returns organization detail plus temporary development acceptance token.

- Added endpoint:
  - `POST /api/platform/organizations/:id/owner-invitation`

- The owner invitation endpoint:
  - Allows `SUPER_ADMIN` to generate a new owner invitation for an existing organization.
  - Only works for `TRIAL` or `ACTIVE` organizations.
  - Blocks organizations with an active owner.
  - Blocks organizations with a pending owner invitation.
  - Blocks owner emails already used by existing users.
  - Blocks owner emails with active pending invitations.
  - Returns a temporary development acceptance token.

Frontend:

- Added API client functions:
  - `onboardPlatformOrganization`
  - `createPlatformOwnerInvitation`

- Added frontend types:
  - `OnboardPlatformOrganizationInput`
  - `OnboardPlatformOrganizationResponse`
  - `PlatformOwnerOnboardingInvitation`
  - `CreatePlatformOwnerInvitationInput`
  - `CreatePlatformOwnerInvitationResponse`

- Added page:
  - `/dashboard/platform/organizations/new`

- The new organization page:
  - Allows `SUPER_ADMIN` to create a customer organization.
  - Allows entering owner email.
  - Supports account type, plan, billing/support email, timezone, locale, max users, max active leads, and AI credit limits.
  - Shows a success panel after creation.
  - Shows the temporary development invitation link.
  - Allows opening the public invitation acceptance page.
  - Links to the created organization detail page.

- Updated:
  - `/dashboard/platform/organizations`

- Added:
  - `Create organization` action button.

- Updated:
  - `/dashboard/platform/organizations/:id`

- Added Owner onboarding panel:
  - Shows `Active owner found` when the organization already has an active owner.
  - Shows `Owner invitation pending` when an owner invitation is pending.
  - Shows `Owner setup needed` when there is no active owner and no pending owner invitation.
  - Allows generating a new owner invitation only when valid.
  - Shows temporary development invitation link after creating a new owner invitation.

Runtime validation completed:

- `SUPER_ADMIN` created a new organization through backend endpoint.
- Backend created pending `OWNER` invitation.
- Public invitation preview worked.
- Public invitation acceptance created the owner user.
- New owner could log in successfully.
- Frontend create organization page worked.
- Frontend displayed development invitation link.
- Public invitation acceptance from frontend worked.
- New owner reached dashboard successfully.
- Organization detail showed active owner state correctly.
- Attempting to create a second owner invitation while one is pending returned `409`.
- Build passed with 3 successful tasks.

Current SaaS onboarding flow is now:

`SUPER_ADMIN creates organization → SUPER_ADMIN invites OWNER → OWNER accepts → OWNER manages their team`