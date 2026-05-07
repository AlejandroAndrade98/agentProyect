# Deployment & Infrastructure

## Estrategia de Despliegue
El sistema está diseñado para ser "Portable", permitiendo correr en un Mac Mini localmente o migrar a la nube sin cambios de código.

### Entorno Docker
Se utiliza Docker Compose para orquestar los servicios:
- **Build Context:** El contexto de construcción es la raíz del monorepo (`.`), permitiendo que los Dockerfiles de cada app accedan a `packages/shared`, `packages/ai` y `packages/database`.
- **Imágenes:** Basadas en Alpine Linux para minimizar el consumo de RAM y disco.
- **Persistencia:** Volúmenes externos para PostgreSQL y Redis.

## Infraestructura Sugerida (Mac Mini 24/7)
- **OS:** macOS con Docker Desktop o Colima.
- **Reverse Proxy:** Caddy para gestión de SSL y redirecciones HTTP$\to$HTTPS.
- **Backups:** Scripts de `pg_dump` programados vía cron que guarden copias en un volumen externo o nube.

## Variables de Entorno
Se define un archivo `.env.example` que cubre:
- Conexiones a DB y Redis.
- Secretos de JWT.
- Keys de Providers de IA (OpenAI, Gemini, Anthropic).
- Configuración de retención de datos.
