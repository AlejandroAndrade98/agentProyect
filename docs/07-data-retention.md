# Data Retention Policy

## Filosofía de Conservación
Diferenciamos entre **Datos Comerciales** (valor permanente) y **Datos Técnicos/Temporales** (valor efímero).

## Datos de Conservación Permanente
No se borran automáticamente, solo se pueden archivar o marcar con soft-delete:
- Organizaciones y Usuarios.
- Empresas, Contactos y Leads.
- Notas y AcceptedAiInsights.
- Relaciones comerciales.
- Audit Logs (conservación de 1 año).

## Datos Temporales y Limpieza (Maintenance Jobs)
Se implementan jobs en el `Worker` para limpiar los siguientes datos:

| Tipo de Dato | Política de Retención | Acción |
| :--- | :--- | :--- |
| Sesiones/Refresh Tokens | 7 días | Borrado físico |
| AiSuggestions (Pending) | 30 días | Expiración $\to$ Borrado |
| AiSuggestions (Rejected) | 30 días | Borrado físico |
| Prompt Input Texts | 30 días | Limpieza de texto (mantener hash) |
| Technical Logs | 30 días | Rotación/Borrado |
| Export Files | 7 días | Borrado físico |
| Tareas Completadas | 90 días | Archivo |

## Procedimiento de Borrado
1. El Worker ejecuta el job de limpieza.
2. Se identifican los registros que cumplen la condición de tiempo.
3. Se ejecutan borrados masivos optimizados.
4. Se registra la cantidad de datos limpiados en los logs de mantenimiento.
