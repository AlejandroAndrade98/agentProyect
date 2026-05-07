# AI Rules & Governance

## Filosofía: Human-in-the-Loop
La IA en Sales AI Platform es un asistente de extracción y redacción, nunca un agente autónomo con permisos de escritura directa en la base de datos comercial.

### Reglas Innegociables
1. **Prohibición de Escritura Directa:** La IA nunca crea un `Contact`, `Lead`, `Task` o `Note` directamente. Solo crea `AiSuggestion` o `AiExtraction`.
2. **Prohibición de Comunicación:** La IA nunca envía correos ni mensajes externos. Solo genera borradores para revisión humana.
3. **Prohibición de Borrado:** La IA nunca puede eliminar datos.
4. **Estado de Sugerencia:** Toda salida de IA debe nacer con el estado `PENDING_REVIEW`.

## Flujo de Trabajo de la IA
1. **Recepción:** El sistema recibe un texto y un comando (ej: "Extraer Datos").
2. **Procesamiento:** El `AiService` selecciona el provider activo y aplica el prompt específico.
3. **Estructuración:** La IA debe responder estrictamente en formato JSON siguiendo la interfaz definida en el `shared` package.
4. **Validación:** El sistema valida que el JSON sea coherente antes de guardarlo como sugerencia.
5. **Interacción Humana:**
   - El usuario ve los campos sugeridos.
   - El usuario puede cambiar el `importanceLevel`.
   - El usuario acepta o rechaza.

## Gestión de Prompts
Los prompts están desacoplados del código y se almacenan en el paquete `packages/ai`. Deben incluir:
- Instrucciones de rol (Senior Sales Assistant).
- Restricciones de formato (Strict JSON).
- Definición de `importanceLevel` para que la IA sugiera el nivel correcto basándose en señales comerciales.
