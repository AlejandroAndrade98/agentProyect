# API Contract

## Generalidades
- **Base URL:** `/api`
- **Formato:** JSON
- **Autenticación:** Bearer Token (JWT)
- **Aislamiento:** Todas las rutas comerciales requieren validación de `organizationId`.

## Endpoints Principales

### Auth
- `POST /auth/register`: Registro de usuario y creación de organización.
- `POST /auth/login`: Autenticación y entrega de Access/Refresh tokens.
- `POST /auth/refresh`: Rotación de tokens.
- `GET /auth/me`: Perfil del usuario actual.

### CRM Core (Pattern: GET /entity, POST /entity, GET /entity/:id, PATCH /entity/:id)
- `/companies`: Gestión de empresas.
- `/contacts`: Gestión de contactos.
- `/leads`: Gestión de leads (incluye cambio de estado).
- `/tasks`: Gestión de tareas (incluye marcado de completado).
- `/notes`: Notas rápidas.

### AI Services
- `POST /ai/analyze-message`: Analiza un texto y sugiere insights.
- `POST /ai/extract-important-data`: Extrae entidades (Contactos, Leads, etc) de un texto.
- `POST /ai/generate-reply`: Sugiere una respuesta comercial basada en contexto.
- `POST /ai/suggest-next-steps`: Sugiere la siguiente acción comercial.

### AI Review Workflow
- `GET /ai-extractions`: Lista sugerencias pendientes.
- `POST /ai-extractions/:id/accept`: Convierte la sugerencia en dato oficial.
- `POST /ai-extractions/:id/edit-and-accept`: Permite modificar antes de guardar.
- `POST /ai-extractions/:id/reject`: Marca como rechazada y programa limpieza.

### Exports & Usage
- `POST /exports`: Solicita la creación de un archivo (CSV/JSON).
- `GET /exports/:id/download`: Descarga el archivo generado.
- `GET /usage/current`: Muestra consumo de tokens y límites del plan.
