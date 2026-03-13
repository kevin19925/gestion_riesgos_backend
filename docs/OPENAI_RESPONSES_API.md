# OpenAI: usar solo la Responses API (nueva)

Este documento define qué API de OpenAI usar en el módulo de IA del sistema de riesgos, para **no** implementar con APIs viejas y evitar migraciones después.

---

## No usar (APIs antiguas / deprecadas)

| API | Estado | Motivo |
|-----|--------|--------|
| **Chat Completions** (`POST /v1/chat/completions`) | Legacy | Sigue soportada pero ya no es el camino recomendado. Responses la reemplaza. |
| **Assistants API** (assistants, threads, runs) | **Deprecada** | Cierre previsto **26 de agosto de 2026**. No iniciar nada nuevo con Assistants. |
| **Completions** (modelo antiguo `/v1/completions`) | Legacy/Deprecada | Reemplazada por Chat y luego por Responses. |

En código **no** debe aparecer:

- `client.chat.completions.create(...)`
- `client.beta.assistants.*`, `client.beta.threads.*`, `client.beta.runs.*`
- Endpoint `https://api.openai.com/v1/chat/completions`
- Endpoint `https://api.openai.com/v1/assistants`, `/threads`, `/runs`

---

## Usar: Responses API (nueva)

- **Endpoint:** `POST https://api.openai.com/v1/responses`
- **Documentación:**  
  - [Migrate to the Responses API](https://platform.openai.com/docs/guides/migrate-to-responses)  
  - [Create a model response (API Reference)](https://platform.openai.com/docs/api-reference/responses/create)  
  - [Prompting (Prompts en el dashboard)](https://platform.openai.com/docs/guides/prompting)

### Ventajas

- Recomendada para **todos los proyectos nuevos**.
- Mejor caché → menor costo (40–80 % vs Chat Completions).
- Soporta **tools** (function calling), búsqueda web, file search, code interpreter, MCP, etc.
- **Conversaciones:** parámetro `conversation` o `previous_response_id` para multi-turno.
- Instrucciones de sistema: **`instructions`** (en el body) o **`prompt` con `prompt_id`** (configurado en el dashboard, ver abajo).

---

## Configurar todo en el dashboard (sin poner instructions en código)

Puedes definir las **system instructions** (y variables) en el **dashboard de OpenAI** y en tu backend solo enviar el **ID del prompt**. Así no llevas el texto del asistente en el código.

En la Responses API se usa el concepto de **Prompt** (gestión de prompts en el dashboard), no el objeto “Assistant” de la API antigua:

1. En el [dashboard de OpenAI](https://platform.openai.com/chat) creas y editas un **Prompt** (instrucciones de sistema, tono, reglas).
2. Publicas una versión y copias el **`prompt_id`** (ej. `pmpt_xxxx`). El ID apunta a la última versión publicada.
3. En tu backend llamas a **Responses API** con **`prompt`** en lugar de `instructions`:

```json
{
  "model": "gpt-4o-mini",
  "prompt": {
    "prompt_id": "pmpt_xxxxxxxx",
    "variables": {
      "nombre_usuario": "Juan",
      "rol": "Dueño de proceso"
    }
  },
  "input": "¿Cuántos riesgos tengo?"
}
```

- **Variables:** en el texto del prompt en el dashboard puedes usar `{{nombre_usuario}}`, `{{rol}}`, etc. Las rellenás desde código en `prompt.variables`.
- Las **tools/funciones** se suelen seguir pasando en el body del request en **`tools`** (la definición de las funciones). Si el dashboard permite asociar tools a un prompt en tu versión, se puede usar eso; si no, `instructions`/contenido del prompt definen el comportamiento y las tools van en el request.

**Resumen:** Sí, puedes usar “el asistente del dashboard” en el sentido de **Prompt**: lo configuras en OpenAI (system instructions, variables), usas **Responses API** y en el body mandas **`prompt: { prompt_id: "pmpt_xxx", variables: {...} }`** + **`input`** (+ **`tools`** si aplica). No usas Assistants API (threads, runs); solo Responses API + `prompt_id`.

---

## Forma del request (Responses API)

### Endpoint

```http
POST https://api.openai.com/v1/responses
Content-Type: application/json
Authorization: Bearer <OPENAI_API_KEY>
```

### Parámetros principales del body

| Parámetro | Tipo | Uso |
|-----------|------|-----|
| `model` | string | Ej. `"gpt-4o"`, `"gpt-4o-mini"`, `"gpt-4.1"` (revisar modelos actuales en la doc). |
| `instructions` | string | **System instructions** en línea (si no usas `prompt`). |
| `prompt` | object | **Alternativa a `instructions`:** `{ "prompt_id": "pmpt_xxx", "variables": {} }` — instrucciones definidas en el dashboard. |
| `input` | string \| array | Mensaje actual del usuario (string) o lista de ítems (mensajes previos + nuevo). |
| `conversation` | string \| { id: string } | ID de conversación para mantener contexto (si usamos Conversations API o nuestro propio ID en Mongo). |
| `previous_response_id` | string | Para encadenar con la respuesta anterior sin enviar de nuevo todo el historial. |
| `tools` | array | Tools/funciones que el modelo puede llamar (p. ej. consultar riesgos/procesos del usuario). |
| `store` | boolean | Por defecto `true`. Si no quieres que OpenAI guarde en su lado, `store: false`. |

### Ejemplo mínimo (instrucciones + un mensaje)

```json
{
  "model": "gpt-4o-mini",
  "instructions": "Eres el asistente del sistema de gestión de riesgos. Solo usas la información que te proporciona el backend. Responde en español.",
  "input": "¿Cuántos riesgos tengo en el proceso actual?"
}
```

### Ejemplo con historial (multi-turno)

Puedes enviar un array de mensajes en `input` con roles `system`/`developer`, `user`, `assistant` (según la doc de Items):

```json
{
  "model": "gpt-4o-mini",
  "instructions": "Eres el asistente del sistema de gestión de riesgos...",
  "input": [
    { "role": "user", "content": "¿Cuántos riesgos hay?" },
    { "role": "assistant", "content": "Tienes 5 riesgos en el proceso actual." },
    { "role": "user", "content": "¿Cuál tiene mayor nivel?" }
  ]
}
```

O usar `conversation` (si usas Conversations API de OpenAI) o tu propio `conversationId` guardado en Mongo y reconstruir los últimos N mensajes desde ahí.

---

## Forma de la respuesta (Responses API)

- La respuesta **no** tiene `choices[0].message.content` como en Chat Completions.
- Tiene un **array `output`** de ítems (mensajes, tool_calls, etc.).
- Para sacar solo el texto de la respuesta:
  - En el SDK: **`response.output_text`** (helper que concatena el texto de salida).
  - A mano: recorrer `response.output` y tomar el contenido de los ítems de tipo mensaje del asistente.

No confiar en `completion.choices[0].message.content`; ese formato es de Chat Completions.

---

## Function calling (tools) en Responses API

- Se definen en **`tools`** en el body del request.
- La forma del tool (nombre, parámetros, etc.) puede diferir de Chat Completions; hay que seguir la guía actual:
  - [Function calling (Responses API)](https://platform.openai.com/docs/guides/function-calling?api-mode=responses)
- Cuando el modelo devuelve una llamada a una tool, tu backend la ejecuta (consultando **solo** lo que el usuario tiene permiso a ver), y puedes enviar el resultado en un siguiente request o en el mismo flujo según la doc.

---

## Resumen para implementación en este proyecto

1. **Solo** llamar a `POST /v1/responses` (o `client.responses.create(...)` si usas el SDK de OpenAI).
2. **System instructions** del asistente → campo **`instructions`** del request.
3. **Memoria / conversación** → guardar en **Mongo** (conversaciones y mensajes); al llamar a la API, construir `input` con los últimos N mensajes o usar `previous_response_id` si aplica.
4. **Permisos** → el backend determina qué datos puede ver el usuario y solo esos se pasan a la IA (en `instructions` como contexto o vía resultados de tools).
5. **No** usar `chat.completions`, **no** usar Assistants API (assistants, threads, runs).

Así te mantienes en la versión nueva de la API y evitas migrar más adelante.
