# Current Session State: Sales AI Platform

## 1. Resumen del Proyecto

Plataforma SaaS multiempresa de CRM ligero potenciado por IA para vendedores, agencias, freelancers y equipos comerciales pequeños.

El sistema implementa un flujo de **Sugerir -> Revisar -> Aceptar**, donde la IA no escribe datos oficiales sin intervención humana.

El caso inicial de referencia es SIMONA Smart Media, pero el producto no debe quedar acoplado a SIMONA. SIMONA debe ser tratado solo como un tenant inicial/demo.

## 2. Stack Definido

- **Monorepo:** pnpm Workspaces + Turborepo.
- **Frontend:** Next.js, TypeScript, Tailwind CSS.
- **Backend:** NestJS, TypeScript.
- **Worker:** NestJS + BullMQ + Redis.
- **Base de Datos:** PostgreSQL 16.
- **ORM:** Prisma 5.22.0.
- **IA:** Capa desacoplada con `AiProvider` interface para soportar OpenAI, Gemini y Anthropic en el futuro.
- **Infraestructura:** Docker Compose.
- **Entorno local/Docker:** Node 20 y pnpm 9.0.0.

## 3. Reglas Centrales del Proyecto

- No usar SQLite.
- No usar MySQL.
- No usar `latest` en dependencias críticas.
- No usar `prisma db push` como flujo principal.
- Usar Prisma migrations.
- Docker desde el día 1.
- Las API keys nunca van en frontend.
- La IA se llama desde backend, nunca desde frontend.
- No avanzar de fase sin aprobación.
- Trabajar paso a paso, con cambios pequeños y revisables.
- No usar `allow all edits`.
- Si hay errores, primero diagnosticar antes de proponer cambios grandes.
- No hacer overwrites completos de archivos importantes sin revisar el diff.

## 4. Reglas Multi-tenant

- Toda entidad comercial sensible debe tener `organizationId`.
- Ningún usuario puede consultar datos de otra organización.
- Ningún service comercial debe consultar datos sin filtrar por `organizationId`.
- La protección multi-tenant debe existir en guards/contexto y también en la capa de datos/services.
- Para Fase 3, el enfoque aprobado es filtrado explícito en services usando el `organizationId` del usuario autenticado.
- No implementar Prisma extensions automáticas todavía.

## 5. Reglas de IA Human-in-the-loop

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

## 6. Fases Completadas

- [x] **Fase 0:** Documentación técnica, visión de producto y ADRs.
- [x] **Fase 1, Scaffolding:** Estructura de carpetas, archivos raíz, shells de apps/packages y Dockerfiles mínimos. Validado con `pnpm build` exitoso.
- [x] **Fase 2, Database & Seed:** Definición de esquema Prisma multi-tenant, migración inicial aplicada y seed de datos demo.
- [x] **Fase 3, Backend Base, Bloque 3.1:** Infraestructura base del API completada y validada.
- [x] **Fase 3, Backend Base, Bloque 3.2:** Auth Core completado y validado.
- [x] **Fase 3, Backend Base, Bloque 3.3:** Refresh Tokens & Logout completado y validado en pasos críticos.
- [x] **Fase 3, Backend Base, Bloque 3.4A:** Infraestructura de guards, decorators y contexto de usuario autenticado implementada, compilada y commiteada.
- [x] **Fase 3, Backend Base, Bloque 3.5:** Endpoints privados `users/me` y `organizations/current` implementados y validados en runtime.
- [x] **Fase 3, Backend Base, Bloque 3.6:** Validaciones finales completadas. Backend base cerrado.


## 7. Estado Actual

La Fase 3 Backend Base quedó completada y validada.

Bloques completados:

- **Bloque 3.1:** ConfigModule, DatabaseModule, PrismaService y HealthModule.
- **Bloque 3.2:** Auth Core con login, bcrypt y JWT access token.
- **Bloque 3.3:** Refresh tokens persistentes, rotación y logout.
- **Bloque 3.4A:** JwtAuthGuard, RolesGuard, Roles decorator, CurrentUser decorator y contexto base de usuario autenticado.
- **Bloque 3.5:** `GET /api/users/me` y `GET /api/organizations/current` protegidos con `JwtAuthGuard`.
- **Bloque 3.6:** Validaciones finales de Backend Base.

Próximo paso seguro:

- Planear Fase 4.
- No implementar Fase 4 sin revisar primero alcance, entidades y endpoints.

Estado actual exacto:

- `POST /api/auth/login` funciona.
- `POST /api/auth/refresh` funciona.
- `POST /api/auth/logout` funciona.
- Refresh token se guarda en DB solo como hash SHA-256.
- Login devuelve `accessToken`, `refreshToken` y resumen seguro del usuario.
- Refresh rota tokens correctamente.
- Logout revoca el refresh token recibido.
- Logout es idempotente, responde `200 OK` aunque el token ya esté revocado.
- `passwordHash` no se expone en respuestas.
- `pnpm build` pasó después de implementar logout.

- `JwtAuthGuard` existe y valida access tokens desde `Authorization: Bearer <accessToken>`.
- `RolesGuard` existe y permite validar roles mediante metadata.
- `@Roles()` existe para declarar roles permitidos.
- `@CurrentUser()` existe para acceder al usuario autenticado desde controladores.
- El usuario autenticado queda representado como `id`, `organizationId` y `role`.
- `pnpm build` pasó después de implementar 3.4A.
- Commit realizado: `5450742 feat(api): add auth guards and user context`.


## Fase 4.1: Companies API

Estado: completado, validado, commiteado y pusheado.

Objetivo:
- Implementar el primer módulo comercial real del CRM.
- Crear CRUD base para empresas.
- Validar protección con JWT.
- Aplicar filtrado multi-tenant usando `currentUser.organizationId`.

Archivos creados:
- `apps/api/src/companies/companies.module.ts`
- `apps/api/src/companies/companies.controller.ts`
- `apps/api/src/companies/companies.service.ts`
- `apps/api/src/companies/dto/create-company.dto.ts`
- `apps/api/src/companies/dto/update-company.dto.ts`

Archivos modificados:
- `apps/api/src/app.module.ts`

Endpoints implementados:
- `GET /api/companies`
- `GET /api/companies/:id`
- `POST /api/companies`
- `PATCH /api/companies/:id`
- `DELETE /api/companies/:id`

Reglas aplicadas:
- Todos los endpoints protegidos con `JwtAuthGuard`.
- Uso de `@CurrentUser()`.
- Nunca se recibe `organizationId` desde body, params o query.
- Las consultas usan `currentUser.organizationId`.
- Las lecturas filtran por `deletedAt: null`.
- `DELETE` usa soft delete con `deletedAt: new Date()`.
- No se devuelven relaciones todavía.
- No se implementó archive/restore.
- No se implementó IA.
- No se modificó `schema.prisma`.

Validaciones realizadas:
- `pnpm build` exitoso.
- `GET /api/companies` sin token devuelve `401`.
- `POST /api/companies` crea una empresa correctamente.
- `GET /api/companies` lista empresas del tenant autenticado.
- `GET /api/companies/:id` consulta una empresa por ID.
- `PATCH /api/companies/:id` actualiza una empresa.
- `DELETE /api/companies/:id` aplica soft delete.
- Luego del soft delete, `GET /api/companies/:id` devuelve `404`.

Resultado:
- Companies API queda lista como primer módulo comercial base del CRM.
- Próximo paso seguro: planear Fase 4.2 Contacts API.

## Fase 4.2: Contacts API

Estado: completado, validado en build y validado en runtime.

Objetivo:
- Implementar el segundo módulo comercial real del CRM.
- Crear CRUD base para contactos.
- Validar protección con JWT.
- Aplicar filtrado multi-tenant usando `currentUser.organizationId`.
- Validar relación opcional con `Company` usando `companyId`.

Archivos creados:
- `apps/api/src/contacts/contacts.module.ts`
- `apps/api/src/contacts/contacts.controller.ts`
- `apps/api/src/contacts/contacts.service.ts`
- `apps/api/src/contacts/dto/create-contact.dto.ts`
- `apps/api/src/contacts/dto/update-contact.dto.ts`

Archivos modificados:
- `apps/api/src/app.module.ts`
- `docs/current-session-state.md`

Endpoints implementados:
- `GET /api/contacts`
- `GET /api/contacts/:id`
- `POST /api/contacts`
- `PATCH /api/contacts/:id`
- `DELETE /api/contacts/:id`

Reglas aplicadas:
- Todos los endpoints protegidos con `JwtAuthGuard`.
- Uso de `@CurrentUser()`.
- Nunca se recibe `organizationId` desde body, params o query.
- Las consultas usan `currentUser.organizationId`.
- Las lecturas filtran por `deletedAt: null`.
- `DELETE` usa soft delete con `deletedAt: new Date()`.
- No se devuelven relaciones todavía.
- No se implementó archive/restore.
- No se implementó IA.
- No se modificó `schema.prisma`.

Regla especial de `companyId`:
- `companyId` es opcional.
- Si el cliente envía `companyId`, el backend valida que la empresa exista dentro del mismo `organizationId`.
- Si la empresa no existe, está eliminada o pertenece a otro tenant, se devuelve `404 Company not found`.

Validaciones realizadas:
- `pnpm build` exitoso.
- `GET /api/contacts` sin token devuelve `401`.
- `POST /api/contacts` crea un contacto correctamente.
- `POST /api/contacts` con `companyId` válido crea un contacto relacionado con una empresa del mismo tenant.
- `GET /api/contacts` lista contactos del tenant autenticado.
- `GET /api/contacts/:id` consulta un contacto por ID.
- `PATCH /api/contacts/:id` actualiza un contacto.
- `POST /api/contacts` con `companyId` inexistente devuelve `404`.
- `DELETE /api/contacts/:id` aplica soft delete y devuelve `deletedAt`.
- Luego del soft delete, `GET /api/contacts/:id` devuelve `404`.

Resultado:
- Contacts API queda lista como segundo módulo comercial base del CRM.
- Próximo paso seguro: planear Fase 4.3 Products API.

## Fase 4.3: Products API

Estado: completado, validado en build y validado en runtime.

Objetivo:
- Implementar el tercer módulo comercial real del CRM.
- Crear CRUD base para productos.
- Validar protección con JWT.
- Aplicar filtrado multi-tenant usando `currentUser.organizationId`.

Archivos creados:
- `apps/api/src/products/products.module.ts`
- `apps/api/src/products/products.controller.ts`
- `apps/api/src/products/products.service.ts`
- `apps/api/src/products/dto/create-product.dto.ts`
- `apps/api/src/products/dto/update-product.dto.ts`

Archivos modificados:
- `apps/api/src/app.module.ts`
- `docs/current-session-state.md`

Endpoints implementados:
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PATCH /api/products/:id`
- `DELETE /api/products/:id`

Reglas aplicadas:
- Todos los endpoints protegidos con `JwtAuthGuard`.
- Uso de `@CurrentUser()`.
- Nunca se recibe `organizationId` desde body, params o query.
- Las consultas usan `currentUser.organizationId`.
- Las lecturas filtran por `deletedAt: null`.
- `DELETE` usa soft delete con `deletedAt: new Date()`.
- No se implementó archive/restore.
- No se implementó IA.
- No se modificó `schema.prisma`.

Validaciones realizadas:
- `pnpm build` exitoso.
- `GET /api/products` sin token devuelve `401`.
- `POST /api/products` crea un producto correctamente.
- `GET /api/products` lista productos del tenant autenticado.
- `GET /api/products/:id` consulta un producto por ID.
- `PATCH /api/products/:id` actualiza un producto.
- `POST /api/products` con `organizationId` en body devuelve `400`.
- `DELETE /api/products/:id` aplica soft delete y devuelve `deletedAt`.
- Luego del soft delete, `GET /api/products/:id` devuelve `404`.

Resultado:
- Products API queda lista como tercer módulo comercial base del CRM.
- Próximo paso seguro: planear Fase 4.4 Leads API.

## 8. Archivos Importantes Creados

Archivos base del monorepo:

- `package.json`
- `turbo.json`
- `pnpm-workspace.yaml`
- `.env.example`
- `.env`
- `.nvmrc`
- `.node-version`
- `.gitignore`
- `pnpm-lock.yaml`

Infraestructura:

- `docker-compose.yml`
- `docker-compose.dev.yml`
- `docker-compose.prod.yml`
- `infra/`

Aplicaciones y paquetes:

- `apps/web/`
- `apps/api/`
- `apps/worker/`
- `packages/database/`
- `packages/shared/`
- `packages/ai/`

Base de datos:

- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/seed.ts`
- `packages/database/prisma/migrations/20260507034039_init/`

Documentación:

- `docs/00-product-vision.md`
- `docs/01-architecture.md`
- `docs/02-database-model.md`
- `docs/03-api-contract.md`
- `docs/04-ai-rules.md`
- `docs/05-security.md`
- `docs/06-deployment.md`
- `docs/07-data-retention.md`
- `docs/08-export-policy.md`
- `docs/current-session-state.md`
- `docs/adr/`

Bloque 3.1:

- `apps/api/src/config/configuration.ts`
- `apps/api/src/database/database.module.ts`
- `apps/api/src/database/prisma.service.ts`
- `apps/api/src/health/health.module.ts`
- `apps/api/src/health/health.controller.ts`

Bloque 3.2:

- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/dto/login.dto.ts`
- `apps/api/src/auth/interfaces/auth-response.interface.ts`

Bloque 3.3:

- `apps/api/src/auth/dto/refresh-token.dto.ts`

Archivos modificados durante 3.3:

- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/interfaces/auth-response.interface.ts`
- `apps/api/src/config/configuration.ts`

## 9. Decisiones Técnicas Tomadas

- **Multi-tenancy:** Aislamiento lógico mediante `organizationId`, validado desde el contexto del usuario y aplicado estrictamente en la capa de acceso a datos.
- **IA:** Patrón Strategy para providers. Flujo obligatorio de revisión humana antes de convertir sugerencias en datos oficiales.
- **Docker:** Contexto de construcción en la raíz para permitir acceso a paquetes compartidos.
- **Build:** Uso de comandos filtrados (`pnpm --filter`) en Dockerfiles.
- **Base de datos:** PostgreSQL desde el día 1.
- **ORM:** Prisma 5.22.0 fijado.
- **Migrations:** Usar Prisma migrations, no `db push`.
- **API base:** NestJS modular con prefijo global `/api`.
- **Refresh tokens:** El token plano se entrega una sola vez al cliente; en DB solo se guarda `tokenHash` con SHA-256.
- **Logout:** Revoca refresh tokens por hash y es idempotente.

## 10. Resolución de Problemas de Instalación, Fase 1

Se resolvieron fallos críticos de `pnpm install` mediante las siguientes acciones:

- **Causa raíz:** `npm/pnpm` tenía configurado `script-shell` como `cmd.exe`, provocando que scripts de `postinstall` entraran en modo interactivo y fallaran.
- **Corrección:** Eliminación de `script-shell` de las configuraciones de npm y pnpm.
- **Entorno establecido:**
  - **Node:** v20.20.2 vía nvm.
  - **pnpm:** v9.0.0 vía corepack.
  - **Prisma:** v5.22.0 fijado para evitar inestabilidades de `latest`.
- **Validación final:** `pnpm install` y `pnpm build` completados exitosamente.

## 11. Detalles de Fase 2: Database & Seed

Objetivo:

- Crear `schema.prisma`.
- Validar schema.
- Crear seed.
- Ejecutar migración inicial.
- Ejecutar seed.

Reglas aplicadas:

- No implementar lógica de negocio.
- No implementar auth.
- No endpoints.
- No IA real.
- No tocar frontend.
- Usar PostgreSQL como único provider.
- Toda entidad sensible debe tener `organizationId`.
- Incluir soft delete donde aplique.
- Incluir `importanceLevel` donde aplique.
- Usar Prisma 5.22.0.
- No usar `db push`.

Resultado:

- **Schema Prisma:** Validado y formateado.
- **Migración inicial:** `20260507034039_init` aplicada con éxito.
- **Prisma Client:** Generado exitosamente.
- **Seed ejecutado exitosamente.**

Datos demo creados:

- Org: `Demo Organization` con slug `demo`.
- User: `owner@example.com` con role `OWNER`.
- Products:
  - Cabify Ads
  - Programmatic Ads
  - DOOH
  - Connected TV

Nota importante:

- El seed fue actualizado durante el Bloque 3.2 para reemplazar `placeholder-hash-for-dev-only` por un hash real de bcrypt.
- Usuario demo: `owner@example.com`.
- Contraseña demo local/dev: `dev-password-2026`.
- No se creó ningún endpoint HTTP temporal de setup.
- No se crearon scripts temporales.

Infraestructura:

- PostgreSQL corriendo en Docker.
- Desde Docker: `postgres:5432`.
- Desde PowerShell local: `localhost:15432`.

## 12. Detalles de Fase 3, Bloque 3.1: Infraestructura Base

Objetivo:

- Crear la base mínima del API.
- Configurar variables de entorno.
- Conectar NestJS con PostgreSQL vía Prisma.
- Exponer un health check real.

Archivos creados:

- `apps/api/src/config/configuration.ts`
- `apps/api/src/database/database.module.ts`
- `apps/api/src/database/prisma.service.ts`
- `apps/api/src/health/health.module.ts`
- `apps/api/src/health/health.controller.ts`

Archivos modificados:

- `apps/api/src/app.module.ts`
- `apps/api/src/main.ts`
- `apps/api/package.json`
- `pnpm-lock.yaml`

Dependencias agregadas:

- `@nestjs/config@^3.0.0`
- `@nestjs/terminus@^10.0.0`
- `@prisma/client@5.22.0` en `apps/api`

Validaciones realizadas:

- `docker compose up -d postgres`
- `docker compose ps postgres`
- `$env:DATABASE_URL="postgresql://postgres:postgres@localhost:15432/sales_ai_db?schema=public"; pnpm --filter @sales-ai/database exec npx prisma validate --schema prisma/schema.prisma`
- `pnpm build`
- `$env:DATABASE_URL="postgresql://postgres:postgres@localhost:15432/sales_ai_db?schema=public"; pnpm --filter @sales-ai/api dev`
- `curl http://localhost:4000/api/health`

Resultado de build:

- `pnpm build` exitoso.
- Todos los paquetes del monorepo compilaron correctamente.

Resultado de health check:

- Endpoint: `GET /api/health`
- Estado: `200 OK`
- Payload observado:

```json
{
  "status": "ok",
  "info": {
    "0": {
      "?column?": 1
    }
  },
  "error": {},
  "details": {
    "0": {
      "?column?": 1
    }
  }
}
```

## 13. Detalles de Fase 3, Bloque 3.2: Auth Core

Objetivo:

- Implementar autenticación básica.
- Validar credenciales mediante bcrypt.
- Generar JWT Access Token.
- Actualizar el seed demo con un hash real de contraseña.
- No implementar todavía refresh tokens, logout ni guards.

Archivos creados:

- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/dto/login.dto.ts`
- `apps/api/src/auth/interfaces/auth-response.interface.ts`

Archivos modificados:

- `apps/api/src/config/configuration.ts`
- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/package.json`
- `packages/database/prisma/seed.ts`
- `pnpm-lock.yaml`

Dependencias agregadas con versiones exactas:

- `bcrypt@5.1.0`
- `@nestjs/jwt@10.2.0`
- `class-validator@0.14.1`
- `class-transformer@0.5.1`
- `@types/bcrypt@5.0.2`

Cambios importantes:

- `LoginDto` creado con validación mediante `class-validator`.
- `ValidationPipe` global configurado en `main.ts` con:
  - `whitelist: true`
  - `forbidNonWhitelisted: true`
  - `transform: true`
- `AuthService` valida credenciales con `bcrypt.compare`.
- Login retorna `401 Unauthorized` genérico si email o password son incorrectos.
- `passwordHash` nunca se retorna.
- JWT Access Token se firma usando variables de entorno:
  - `JWT_ACCESS_SECRET`
  - `JWT_ACCESS_EXPIRES_IN`

Payload del JWT:

```json
{
  "sub": "userId",
  "organizationId": "organizationId",
  "role": "Role"
}
```

Endpoint implementado:

- `POST /api/auth/login`

Respuesta exitosa esperada:

```json
{
  "accessToken": "jwt-token",
  "user": {
    "id": "userId",
    "email": "owner@example.com",
    "name": "Demo Owner",
    "role": "OWNER",
    "organizationId": "organizationId"
  }
}
```

Validaciones realizadas:

- `pnpm build` exitoso.
- Login exitoso con:
  - `owner@example.com`
  - `dev-password-2026`
- Login fallido devuelve `401 Unauthorized`.
- `passwordHash` no se expone.
- `.env` raíz carga correctamente usando:

```ts
envFilePath: ['../../.env', '.env']
```

## 14. Detalles de Fase 3, Bloque 3.3: Refresh Tokens & Logout

Estado: completado y validado en pasos críticos.

Objetivo:

- Implementar sesiones persistentes con refresh tokens.
- Guardar solo hash del refresh token en DB.
- Implementar rotación segura de refresh tokens.
- Implementar logout mediante revocación del refresh token.
- No implementar guards todavía.
- No implementar `CurrentUser` todavía.
- No implementar `UsersModule` ni `OrganizationsModule` todavía.

### 14.1 Subpaso 3.3A: DTO de Refresh Token

Archivo creado:

- `apps/api/src/auth/dto/refresh-token.dto.ts`

Contenido esperado:

```ts
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
```

Validación:

- `pnpm build` exitoso.

### 14.2 Subpaso 3.3B: Login genera Refresh Token

Archivos modificados:

- `apps/api/src/config/configuration.ts`
- `apps/api/src/auth/interfaces/auth-response.interface.ts`
- `apps/api/src/auth/auth.service.ts`

Cambios realizados:

- Se agregó `JWT_REFRESH_EXPIRES_IN` a la configuración.
- `AuthResponse` ahora incluye `refreshToken`.
- `AuthService.login()` genera refresh token.
- El refresh token plano se devuelve al cliente.
- En DB solo se guarda `tokenHash` usando SHA-256.
- El token plano no se guarda en base de datos.

Estrategia aprobada:

- Generar refresh token plano con:

```ts
crypto.randomBytes(64).toString('hex')
```

- Guardar hash con:

```ts
crypto.createHash('sha256').update(refreshToken).digest('hex')
```

Validación:

- `pnpm build` exitoso.

### 14.3 Subpaso 3.3C: Refresh con Rotación

Archivos modificados:

- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/auth.controller.ts`

Endpoint implementado:

- `POST /api/auth/refresh`

Flujo implementado:

- Recibe `refreshToken` en body usando `RefreshTokenDto`.
- Calcula `tokenHash`.
- Usa transacción Prisma.
- Revoca token anterior con `updateMany`.
- Valida que `updateResult.count === 1`.
- Busca token por hash.
- Valida que no esté expirado.
- Valida que el usuario esté activo.
- Crea nuevo refresh token dentro de la transacción.
- Genera nuevo access token fuera de la transacción.
- Retorna nuevo `accessToken`, nuevo `refreshToken` y user summary.

Validaciones realizadas:

- Login devuelve `accessToken`, `refreshToken` y user summary.
- Refresh con token válido devuelve nuevo par de tokens.
- Reutilizar refresh token viejo devuelve `401 Unauthorized`.
- Refresh con token nuevo funciona y devuelve otro nuevo par.
- `passwordHash` no se expone.

Resultado:

- Rotación de refresh tokens validada correctamente.
- `pnpm build` exitoso.

### 14.4 Subpaso 3.3D: Logout

Archivos modificados:

- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/auth.controller.ts`

Endpoint implementado:

- `POST /api/auth/logout`

Flujo implementado:

- Recibe `refreshToken` en body usando `RefreshTokenDto`.
- Calcula `tokenHash` usando `hashToken()`.
- Ejecuta `updateMany` en `refreshToken`:
  - `where: { tokenHash, revokedAt: null }`
  - `data: { revokedAt: new Date() }`
- No lanza error si el token no existe.
- No lanza error si el token ya estaba revocado.
- Retorna siempre:

```json
{
  "message": "Logged out successfully"
}
```

Validaciones realizadas:

- La API arrancó correctamente.
- Endpoints mapeados:
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
- Login exitoso devuelve tokens y user summary.
- Logout con refresh token válido devuelve:

```json
{
  "message": "Logged out successfully"
}
```

- Refresh usando token revocado devuelve `401 Unauthorized`.
- Logout repetido con el mismo token revocado devuelve `200 OK`.
- Login nuevo funcionó.
- `passwordHash` no se expuso en respuestas revisadas.
- `pnpm build` pasó después de implementar logout.

Pendiente menor:

- La última prueba de refresh con un token nuevo después del segundo login fue interrumpida, pero el flujo de refresh ya había sido validado completamente en 3.3C.
- Los pasos críticos de logout quedaron validados:
  - `login -> logout -> refresh con token revocado = 401`
  - `logout repetido -> 200 OK`


## 15. Detalles de Fase 3, Bloque 3.4A: Guards, Roles y Current User

Estado: implementado, compilado y commiteado.

Objetivo:

- Crear la infraestructura base para proteger rutas privadas.
- Validar access tokens enviados por header `Authorization: Bearer <accessToken>`.
- Exponer el contexto del usuario autenticado a futuros controladores.
- Preparar la base tenant-aware para que futuros services filtren por `organizationId`.

Archivos creados:

- `apps/api/src/auth/guards/jwt-auth.guard.ts`
- `apps/api/src/auth/guards/roles.guard.ts`
- `apps/api/src/auth/decorators/current-user.decorator.ts`
- `apps/api/src/auth/decorators/roles.decorator.ts`
- `apps/api/src/auth/interfaces/current-user.interface.ts`

Archivos modificados:

- `apps/api/src/auth/auth.module.ts`
- `.gitignore`

Implementación:

- `JwtAuthGuard`:
  - Extrae el token desde `Authorization: Bearer <token>`.
  - Valida el JWT access token usando `JwtService`.
  - Usa `JWT_ACCESS_SECRET` desde `ConfigService`.
  - Rechaza tokens ausentes, inválidos o expirados con `401 Unauthorized`.
  - Adjunta `request.user` con:
    - `id`
    - `organizationId`
    - `role`

- `RolesGuard`:
  - Lee roles requeridos usando `Reflector`.
  - Usa metadata definida por `@Roles()`.
  - Retorna `403 Forbidden` si el usuario no tiene un rol permitido.

- `@CurrentUser()`:
  - Permite obtener el usuario autenticado en controladores.
  - También permite obtener una propiedad específica, por ejemplo `@CurrentUser('organizationId')`.

- `@Roles()`:
  - Permite declarar roles permitidos en endpoints protegidos.

Interfaz de usuario autenticado:

```ts
export interface CurrentUser {
  id: string;
  organizationId: string;
  role: Role;
}
```

Validación:

- `pnpm build` exitoso.
- Commit realizado:

```text
5450742 feat(api): add auth guards and user context
```

Pendiente en ese momento:

- Todavía no había endpoints protegidos reales para probar runtime.
- La validación funcional de guards se haría en Bloque 3.5 con:
  - `GET /api/users/me`
  - `GET /api/organizations/current`

## 16. Detalles de Fase 3, Bloque 3.5: Users/me y Organizations/current

Estado: implementado y validado en runtime.

Objetivo:

- Crear endpoints privados reales para validar `JwtAuthGuard`.
- Probar `@CurrentUser()` con un access token real.
- Validar que el backend puede leer `userId`, `organizationId` y `role` desde el JWT.
- Consultar datos con filtrado multi-tenant explícito.

Archivos creados:

- `apps/api/src/users/users.module.ts`
- `apps/api/src/users/users.controller.ts`
- `apps/api/src/users/users.service.ts`
- `apps/api/src/organizations/organizations.module.ts`
- `apps/api/src/organizations/organizations.controller.ts`
- `apps/api/src/organizations/organizations.service.ts`

Archivos modificados:

- `apps/api/src/app.module.ts`
- `apps/api/src/auth/auth.module.ts`

Endpoints implementados:

- `GET /api/users/me`
- `GET /api/organizations/current`

Implementación de `GET /api/users/me`:

- Ruta protegida con `JwtAuthGuard`.
- Usa `@CurrentUser()` para obtener:
  - `id`
  - `organizationId`
  - `role`
- `UsersService` consulta usuario usando:
  - `id: currentUser.id`
  - `organizationId: currentUser.organizationId`
  - `deletedAt: null`
- Retorna solo campos seguros:
  - `id`
  - `email`
  - `name`
  - `role`
  - `organizationId`
  - `isActive`
  - `createdAt`
  - `updatedAt`
- No retorna `passwordHash`.
- No retorna relaciones.

Implementación de `GET /api/organizations/current`:

- Ruta protegida con `JwtAuthGuard`.
- Usa `@CurrentUser()` para obtener `organizationId`.
- `OrganizationsService` consulta organización usando:
  - `id: currentUser.organizationId`
  - `deletedAt: null`
  - `archivedAt: null`
- Retorna campos seguros:
  - `id`
  - `name`
  - `slug`
  - `industry`
  - `plan`
  - `maxUsers`
  - `maxActiveLeads`
  - `maxAiRequestsPerMonth`
  - `maxStorageMb`
  - `createdAt`
  - `updatedAt`

Fix aplicado:

- `JwtAuthGuard` dependía de `JwtService`.
- Al usar el guard desde `UsersModule` y `OrganizationsModule`, Nest necesitaba acceso a `JwtService`.
- Se corrigió exportando `JwtModule` desde `AuthModule`:

```ts
exports: [JwtModule, JwtAuthGuard, RolesGuard]
```

Validaciones realizadas:

- API arrancó correctamente.
- Endpoints mapeados:
  - `GET /api/users/me`
  - `GET /api/organizations/current`
- Login exitoso con `owner@example.com`.
- `GET /api/users/me` sin token devuelve `401 Unauthorized`.
- `GET /api/organizations/current` sin token devuelve `401 Unauthorized`.
- `GET /api/users/me` con token válido devuelve `200 OK` y datos seguros del usuario.
- `GET /api/organizations/current` con token válido devuelve `200 OK` y datos seguros de la organización.
- `passwordHash` no se expone.

Resultado:

- Bloque 3.5 validado correctamente.
- Guards y contexto de usuario funcionan en runtime.

## 17. Problemas Resueltos Durante Bloque 3.3

### 17.1 Sintaxis incorrecta de variable de entorno

Problema:

- Se usó sintaxis PowerShell dentro de Bash:

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:15432/sales_ai_db?schema=public"; pnpm --filter @sales-ai/api dev
```

Resultado:

- Bash no tomó la variable.
- La API intentó conectarse a `postgres:5432`.
- Falló la conexión desde host local.

Corrección:

- En Bash usar:

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:15432/sales_ai_db?schema=public" && pnpm --filter @sales-ai/api dev
```

- En PowerShell usar:

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:15432/sales_ai_db?schema=public"; pnpm --filter @sales-ai/api dev
```

### 17.2 Puerto 4000 ocupado

Problema:

- Quedaron procesos background de la API usando el puerto `4000`.
- Se observó error `EADDRINUSE`.

Corrección en PowerShell:

```powershell
$pidToKill = (Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue).OwningProcess; if ($pidToKill) { Stop-Process -Id $pidToKill -Force; Write-Output "Process $pidToKill killed" } else { Write-Output "No process found on port 4000" }
```

### 17.3 Logout quedó temporalmente roto

Problema:

- `auth.controller.ts` tenía `POST /auth/logout`.
- `auth.service.ts` todavía no tenía método `logout()`.
- Build falló con:

```text
Property 'logout' does not exist on type 'AuthService'.
```

Corrección:

- Se agregó método `logout(dto: RefreshTokenDto)` en `AuthService`.
- `pnpm build` pasó después del fix.

## 18 Comandos Útiles Actuales

Levantar PostgreSQL:

```powershell
docker compose up -d postgres
```

Verificar PostgreSQL:

```powershell
docker compose ps postgres
```

Correr API local desde PowerShell:

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:15432/sales_ai_db?schema=public"; pnpm --filter @sales-ai/api dev
```

Correr API local desde Bash:

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:15432/sales_ai_db?schema=public" && pnpm --filter @sales-ai/api dev
```

Liberar puerto 4000 desde PowerShell:

```powershell
$pidToKill = (Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue).OwningProcess; if ($pidToKill) { Stop-Process -Id $pidToKill -Force; Write-Output "Process $pidToKill killed" } else { Write-Output "No process found on port 4000" }
```

Build completo:

```powershell
pnpm build
```

Ver estado Git:

```powershell
git status
```

Ver diff de Auth:

```powershell
git diff -- apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.controller.ts apps/api/src/auth/interfaces/auth-response.interface.ts apps/api/src/auth/dto/refresh-token.dto.ts apps/api/src/config/configuration.ts
```

## 19. Próximos Pasos Exactos

Siguiente paso inmediato:

1. Ejecutar `git status`.
2. Revisar diff de los archivos modificados en 3.3.
3. Confirmar que no quedó proceso API corriendo en puerto `4000`.
4. Si todo está correcto, pedir únicamente el plan técnico del **Bloque 3.4**.

Bloque 3.4 esperado:

- `JwtAuthGuard`
- `RolesGuard`
- `CurrentUser` decorator
- Base tenant-aware
- Validación de JWT access token
- Protección inicial de rutas privadas
- No implementar todavía módulos comerciales.

## Detalles de Fase 3, Bloque 3.6: Validaciones Finales

Estado: completado.

Objetivo:

- Confirmar que Backend Base funciona completo antes de pasar a Fase 4.
- Validar build, API, auth, refresh/logout, guards y endpoints privados.

Validaciones realizadas:

- `GET /api/health` devuelve `200 OK`.
- `POST /api/auth/login` funciona con usuario demo.
- Login devuelve `accessToken`, `refreshToken` y user summary.
- Login no expone `passwordHash`.
- `GET /api/users/me` sin token devuelve `401 Unauthorized`.
- `GET /api/organizations/current` sin token devuelve `401 Unauthorized`.
- `GET /api/users/me` con token válido devuelve `200 OK`.
- `GET /api/organizations/current` con token válido devuelve `200 OK`.
- `POST /api/auth/refresh` con refresh token válido devuelve nuevo par de tokens.
- Reutilizar refresh token viejo devuelve `401 Unauthorized`.
- `POST /api/auth/logout` revoca el refresh token y devuelve `Logged out successfully`.
- Usar refresh token revocado devuelve `401 Unauthorized`.

Resultado:

- Fase 3 Backend Base completada.
- API base lista para iniciar Fase 4 con módulos comerciales multi-tenant.

## 20. Cosas que NO se deben hacer todavía

- **NO** avanzar a Fase 4.
- **NO** implementar IA real.
- **NO** implementar frontend final.
- **NO** implementar módulos comerciales avanzados.
- **NO** implementar contacts/leads/tasks/notes todavía.
- **NO** crear endpoints comerciales todavía.
- **NO** modificar `schema.prisma` sin plan aprobado.
- **NO** instalar dependencias nuevas sin aprobación.
- **NO** usar `allow all edits`.
- **NO** hacer overwrites completos de documentación sin revisar.
- **NO** implementar Prisma extensions automáticas todavía.
- **NO** avanzar al Bloque 3.4 sin revisar primero el plan.