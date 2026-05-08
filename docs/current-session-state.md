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

## 7. Estado Actual

La Fase 3 está en progreso.

Bloques completados:

- **Bloque 3.1:** ConfigModule, DatabaseModule, PrismaService y HealthModule.
- **Bloque 3.2:** Auth Core con login, bcrypt y JWT access token.
- **Bloque 3.3:** Refresh tokens persistentes, rotación y logout.

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

Próximo paso seguro:

- Revisar el estado con `git status` y `git diff`.
- Actualizar documentación si hace falta.
- Luego preparar **solo el plan técnico del Bloque 3.4**, sin implementar todavía.

No avanzar todavía a 3.4 sin plan aprobado.

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

## 15. Problemas Resueltos Durante Bloque 3.3

### 15.1 Sintaxis incorrecta de variable de entorno

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

### 15.2 Puerto 4000 ocupado

Problema:

- Quedaron procesos background de la API usando el puerto `4000`.
- Se observó error `EADDRINUSE`.

Corrección en PowerShell:

```powershell
$pidToKill = (Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue).OwningProcess; if ($pidToKill) { Stop-Process -Id $pidToKill -Force; Write-Output "Process $pidToKill killed" } else { Write-Output "No process found on port 4000" }
```

### 15.3 Logout quedó temporalmente roto

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

## 16. Comandos Útiles Actuales

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

## 17. Próximos Pasos Exactos

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

## 18. Cosas que NO se deben hacer todavía

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