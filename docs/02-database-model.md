# Database Model

## Entidades y Relaciones
El modelo de datos utiliza PostgreSQL con Prisma ORM. Todas las entidades comerciales están vinculadas a una `Organization`.

### Entidades Core
- **Organization:** El tenant raíz. Controla límites de plan y configuración.
- **User:** Miembro de una organización con un rol específico.
- **Company:** Entidades legales clientes. Relación 1:N con Contactos y Leads.
- **Contact:** Personas físicas. Pueden pertenecer a una Company.
- **Lead:** Oportunidad de negocio. Vincula un Contacto y una Company con un estado de venta.
- **Task:** Acciones pendientes. Pueden asociarse a Leads o Contactos.
- **Note:** Información textual libre asociada a cualquier entidad comercial.

### Capa de IA
- **AiSuggestion:** Registro de cada interacción con la IA, guardando el input, output y costo.
- **AiExtraction:** Datos específicos propuestos por la IA para ser convertidos en entidades oficiales.
- **AcceptedAiInsight:** Información valiosa extraída por IA que ha sido validada por el humano y convertida en dato oficial.

## Reglas de Persistencia
- **organizationId:** Obligatorio en todas las tablas excepto `Organization` y `Session`.
- **Soft Delete:** Uso de `deletedAt` para permitir recuperación de datos y auditoría.
- **Importance Level:** Campo `importanceLevel` (LOW, MEDIUM, HIGH, CRITICAL) en todas las entidades de valor comercial.
- **Audit Logs:** Tabla `AuditLog` para registrar cambios críticos (quién, qué, cuándo).
