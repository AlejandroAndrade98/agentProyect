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