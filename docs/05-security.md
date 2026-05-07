# Security Specification

## Autenticación y Autorización
- **JWT:** Implementación de Access Tokens (vida corta) y Refresh Tokens (vida larga, hasheados en DB).
- **Roles:** Implementación de RBAC (Role Based Access Control) con los niveles: `SUPER_ADMIN`, `OWNER`, `ADMIN`, `SALES`, `VIEWER`.
- **Tenant Isolation:**
  - **Capa de Guard:** El `TenantGuard` valida que el `userId` del token tenga acceso a la `organizationId` de la petición.
  - **Capa de Datos:** Todas las consultas a la base de datos incluyen el filtro `organizationId`. Se prohíbe el uso de queries globales en módulos comerciales.

## Protección de Datos
- **Password Hashing:** Uso de Argon2 o Bcrypt.
- **Secrets:** Todas las API Keys de IA y secretos de JWT se cargan estrictamente vía variables de entorno (`.env`).
- **Logs:** No se registran payloads completos de peticiones que contengan datos sensibles.
- **Rate Limiting:** Implementación de límites por IP y por organización para evitar abusos de la API de IA.

## Auditoría
- **Audit Logs:** Cada acción de creación, edición o borrado en entidades comerciales genera un registro en `AuditLog` indicando el actor, la entidad y el timestamp.
