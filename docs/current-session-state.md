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