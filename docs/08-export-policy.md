# Export Policy

## Objetivo
Permitir que el cliente sea dueño de sus datos, facilitando la portabilidad y el análisis externo.

## Tipos de Exportación
Se permiten los siguientes conjuntos de datos:
- **Contactos:** Lista completa con sus datos asociados.
- **Empresas:** Directorio de empresas.
- **Leads:** Pipeline de ventas con estados y prioridades.
- **Tareas:** Historial de actividades.
- **AI Suggestions:** Registro de lo que la IA propuso (antes de ser aceptado).
- **Accepted Insights:** El conocimiento refinado y validado por el humano.

## Formatos Soportados
- **CSV:** Para análisis en hojas de cálculo (MVP).
- **JSON:** Para integraciones técnicas (MVP).
- **XLSX / PDF:** Planificados para fases posteriores.

## Flujo de Exportación (Asíncrono)
Dado que los exports pueden ser pesados, se procesan vía BullMQ:
1. El usuario solicita el export via `POST /exports`.
2. El API crea un `ExportJob` con estado `PENDING`.
3. El Worker toma el job, genera el archivo y lo guarda en el `EXPORTS_DIR`.
4. El Worker marca el job como `COMPLETED` y define el `expiresAt`.
5. El usuario descarga el archivo vía `GET /exports/:id/download`.

## Seguridad y Caducidad
- Los archivos de exportación no son públicos.
- El enlace de descarga requiere autenticación y validación de tenant.
- Los archivos expiran y son borrados automáticamente tras 7 días.
