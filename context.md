# Contexto — Backend COMWARE (gestión de riesgos)

Documento vivo: **todo cambio** en API, dominio, env, CORA o integraciones debe reflejarse aquí en la misma tarea. El `README.md` es solo arranque rápido.

---

## 1. Stack y arranque

| Tecnología | Uso |
|------------|-----|
| Node.js + Express 4 + TypeScript | API REST bajo prefijo **`/api`** |
| Prisma 7 + PostgreSQL | Persistencia principal |
| Redis (opcional) | Caché de listados/mapas de riesgos (`redisSet` / `redisDel` por claves tipo `mapa:puntos:...`) |
| MongoDB | Historial de conversaciones del asistente CORA |
| JWT + 2FA | Autenticación (`/auth`, `/auth/2fa`, `/admin/2fa`) |

**Puerto por defecto:** `8080` (`PORT`). **Health:** `GET /api/health` → `status`, `db` (query `SELECT 1`), `uptime`, `version`.

Al arrancar: verificación de esquema BD y **cron jobs** (alertas de vencimiento de planes de acción).

**Comprobaciones locales (sin levantar API):** `npm run test:residual-modo` (normalización `residualModo`), `npm run test:estrategico-engine` (golden fila Excel Anexo 6).

**Entrada:** `src/index.ts`, `src/app.ts`. **Registro de rutas:** `src/routes/index.ts` (orden importante: `planTrazabilidadRoutes` montado en **`/`** antes que otras rutas que pudieran sombrear).

---

## 2. Modelo de dominio (Prisma — resumen)

| Entidad | Rol en el sistema |
|---------|-------------------|
| **Usuario**, **Role**, **Cargo**, **Gerencia**, **Area** | Identidad, permisos y organización. `Role`: `codigo`, `ambito` (`SISTEMA` / `OPERATIVO`), `permisos` JSON. |
| **Proceso** | Unidad de análisis: nombre único, estado (`borrador`, etc.), área, gerencia, responsable, documentos, participantes, **ProcesoResponsable** (varios usuarios con `modo`: dueño/supervisor). **`residualModo`:** `ESTANDAR` (mitigación % estándar) o `ESTRATEGICO` (criterios MA / motor residual estratégico en `estrategicoResidual.*`). |
| **Riesgo** | Pertenece a un `procesoId`, `numero` único por proceso. **Tipologías:** `tipologiaTipo1Id`→TipoRiesgo, `tipologiaTipo2Id`→SubtipoRiesgo, `tipologiaTipo3Id`/`tipologiaTipo4Id`→TipologiaRiesgoExtendida (niveles 3 y 4). **clasificacion:** texto (ver §3). Objetivo opcional (`objetivoId`→Objetivo). |
| **CausaRiesgo** | Causas del riesgo: `descripcion`, `fuenteCausa`, `frecuencia` (ligada a catálogo), `seleccionada`. Enlaza **ControlRiesgo**, **PlanAccion**, **AlertaVencimiento**, **Incidencia**. |
| **EvaluacionRiesgo** | 1:1 con riesgo. Impactos 1–5 por dimensión (personas, legal, ambiental, procesos, reputación, económico, tecnológico, SGSI…), `probabilidad`, `impactoGlobal`, `impactoMaximo`, `riesgoInherente`, `nivelRiesgo`; campos **residuales** `probabilidadResidual`, `impactoResidual`, `riesgoResidual`, `nivelRiesgoResidual`. |
| **Control** | Controles “clásicos” del riesgo: diseño/ejecución/solidez, `efectividad`, `riesgoResidual` float, `clasificacionResidual`; opcional vínculo `causaRiesgoOrigenId` (control derivado de causa/plan). |
| **ControlRiesgo** | Controles **normalizados** por causa: criterios (aplicabilidad, cobertura, facilidad, segregación, naturaleza, desviaciones), evaluación preliminar/definitiva, mitigación, vínculo opcional a plan. Base del **recálculo residual** (`recalculoResidual.service.ts`). |
| **PriorizacionRiesgo** | 1:1 con riesgo: `calificacionFinal`, `respuesta` (Aceptar/Evitar/Reducir/Compartir), responsable, puntaje. |
| **PlanAccion** | Puede colgar de `priorizacionId`, `riesgoId`, `causaRiesgoId`, `incidenciaId`. Estados, fechas, seguimiento, evidencias, `tipoGestion`, `origenMigracion`. |
| **Incidencia** | Materialización / evento vinculado a proceso, riesgo y/o causa. |
| **Catalogos** | `TipoRiesgo`, `SubtipoRiesgo`, `TipologiaRiesgoExtendida`, `FrecuenciaCatalog`, `FuenteCatalog`, `OrigenCatalog`, `ConsecuenciaCatalog`, `ImpactoTipo` + `ImpactoNivel`. |
| **Contexto** / **ContextoItem** | Contexto interno/externo del proceso (items con `tipo`, `signo`, opción `enviarADofa`). |
| **DofaItem**, **Normatividad** | DOFA y requisitos normativos por proceso. |
| **MapaConfig**, **CalificacionInherenteConfig** | Ejes de mapas y **configuración de calificación inherente** (fórmula, rangos `RangoCalificacion`, excepciones, regla de agregación). |
| **ConfiguracionResidual** + tablas hijas | Pesos de criterios, rangos de evaluación del control, tabla de mitigación por etiqueta de efectividad, rangos de **nivel de riesgo residual**, % dimensión cruzada. |
| **Configuracion** | Clave-valor (ej. `pesos_impacto` JSON array `{ key, porcentaje }` en 0–100). |
| **Observacion**, **HistorialEvento**, **Audit** | Trazabilidad y comentarios de supervisión. |
| **AlertaVencimiento** | Alertas de planes próximos a vencer; usuario, lectura. |
| **ReunionProceso**, **AsistenciaReunion**, etc. | Módulo reuniones. |

Esquema canónico: `prisma/schema.prisma`. Scripts SQL históricos: carpeta `migrations/`.

---

## 3. Clasificación del riesgo (amenaza vs oportunidad)

En código (`riesgos.controller.ts` y filtros) se usan **exactamente** estos literales:

- **Oportunidad / consecuencia positiva:** `Riesgo con consecuencia positiva`
- **Amenaza / consecuencia negativa:** `Riesgo con consecuencia negativa`

**Comportamiento clave:** si el riesgo es de **consecuencia positiva**, la función `recalcularRiesgoInherenteDesdeCausas` **no** aplica el mismo recálculo automático desde causas que en los negativos (el flujo de oportunidades es distinto al Excel/amenazas).

En catálogos puede coexistir texto corto (ej. consecuencia catalog **Positiva**) con el largo arriba; las consultas de listados/mapas suelen filtrar por el string largo o por exclusión de positivos según endpoint.

---

## 4. Calificación inherente (riesgo inherente y nivel)

1. **Impacto global ponderado** (típico en evaluación): para cada dimensión, `ceil(Σ (nivel_impacto × peso_decimal))`. Los **pesos** por defecto vienen de código; pueden **sobreescribirse** con la fila Prisma **`Configuracion`** clave **`pesos_impacto`** (JSON: lista `{ key, porcentaje }` con porcentajes 0–100 convertidos a decimal en runtime).

2. **Agregación por causas:** al recalcular desde causas (`recalcularRiesgoInherenteDesdeCausas`), se usa la **CalificacionInherenteConfig** activa (rangos `RangoCalificacion`, reglas de agregación, excepciones, fórmula en `FormulaCalificacionInherente`) como **fuente de verdad** administable.

3. **Mapa (ejes):** frecuencia/probabilidad en eje X e impacto en eje Y derivados de la causa que maximiza la calificación y la evaluación; valores guardados en `EvaluacionRiesgo` (`probabilidad`, `impactoGlobal`).

4. **Casos especiales:** si **impacto máximo = 2** y **probabilidad = 2**, la calificación inherente puede quedar en **3.99** (evitar bindear a celda de mapa); misma lógica alineada en front `calculations.ts` y residual `recalculoResidual.service.ts`.

5. Sin causas (riesgo negativo con evaluación): se puede forzar inherente **0**, nivel **Sin Calificar**, probabilidad/impacto mínimos según implementación del recálculo.

---

## 5. Calificación y recálculo residual

**Servicio principal:** `src/services/recalculoResidual.service.ts` (trabaja con **ControlRiesgo** + **EvaluacionRiesgo**; ya no usa JSON `CausaRiesgo.gestion`).

**Flujo resumido por control:**

1. Puntaje total del control = suma de (aplicabilidad, cobertura, facilidad, segregación, naturaleza) × pesos desde **`configuracionResidual.service`** (config activa).
2. **Evaluación preliminar** según rangos de puntaje (`RangoEvaluacionResidual`).
3. **Evaluación definitiva** ajustada por **desviaciones** (1=A, 2=B, 3=C); reglas especiales (ej. 3 desviaciones → Inefectivo).
4. **Porcentaje de mitigación** desde `TablaMitigacionResidual` según etiqueta de efectividad (ej. Altamente Efectivo, Efectivo, …).
5. **Frecuencia residual** e **impacto residual** según `tipoMitigacion` (frecuencia / impacto / ambas), mitigación y opcional **`porcentajeReduccionDimensionCruzada`**.
6. **Calificación residual** ≈ `frecuenciaResidual × impactoResidual` (con regla 3.99 donde aplique).
7. **Nivel de riesgo residual** = nombre según `RangoNivelRiesgoResidual` (orden y bordes configurables).

La configuración residual activa se lee desde Prisma en los servicios de configuración; los admin la editan por API `/configuracion-residual` y UI de administración.

---

## 6. Mapa de rutas HTTP (`/api`)

| Montaje | Contenido principal |
|---------|----------------------|
| `GET /health` | Estado + DB (sin auth) |
| `/auth`, `/auth/2fa` | Login, refresh, 2FA usuario |
| `/admin/2fa` | Gestión 2FA administrativa |
| `/usuarios`, `/utilidades` | CRUD usuarios, utilidades |
| `/procesos` | CRUD procesos, duplicar, bulk, estados, participantes, documentos… |
| `/procesos/.../responsables` | Responsables múltiples (rutas en `proceso-responsables.routes.ts`, mismo mount bajo `/procesos`) |
| `/riesgos`, `/evaluaciones` | Riesgos, causas, evaluaciones, mapas, estadísticas, recálculos |
| `/catalogos`, `/priorizaciones` | Catálogos de riesgo, frecuencias, impactos, priorización |
| `/areas`, `/cargos`, `/gerencias`, `/roles` | Organización |
| `/controles` | Controles ligados a riesgo (modelo `Control`) |
| `/controles-riesgo` | Controles normalizados `ControlRiesgo` |
| `/incidencias` | Incidencias |
| **`/`** (plan trazabilidad) | `GET /planes-accion`, `PUT /causas/:id/plan/estado`, `POST /causas/:id/plan/convertir-a-control`, `GET /causas/:id/plan/trazabilidad`, `GET /alertas-vencimiento`, `PUT /alertas/:id/marcar-leida` — **requiere auth** |
| `/planes-accion` | Planes de acción (CRUD y operaciones generales) |
| `/cron` | Disparo/consulta de jobs y alertas automáticas |
| `/dofa`, `/normatividad`, `/contexto` | DOFA, normatividad, contexto proceso |
| `/upload` | Subida de archivos (Azure o Cloudinary según env) |
| `/calificacion-inherente` | Config mapa / fórmula / rangos inherente |
| `/configuracion-residual` | Config residual y recálculos |
| `/audit` | Auditoría |
| `/ia` | CORA: OpenAI + contexto de negocio; historial Mongo |
| `/reuniones` | Reuniones por proceso |
| `/debug` | Solo si `NODE_ENV !== 'production'` |

**Convención:** respuestas JSON; códigos HTTP estándar. Tras cambios en listados/mapas, invalidar caché Redis si aplica.

---

## 7. Variables de entorno (principales)

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | PostgreSQL |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | JWT |
| `PORT` | HTTP (default 8080) |
| `NODE_ENV` | `production` u otro |
| `CORS_ORIGIN` / `CORS_ORIGINS` | Orígenes SPA |
| `REDIS_URL` | Caché opcional |
| `OPENAI_API_KEY` | CORA |
| `MONGODB_URI`, `MONGODB_DB_NAME` | Chat CORA |
| `PROMPT_ID` | Flujo IA si aplica |
| `AZURE_STORAGE_*` / `CLOUDINARY_*` | Archivos |

---

## 8. CORA (asistente IA)

- **Código:** `src/services/ia.service.ts`, `src/routes/ia.routes.ts`.
- **System prompt:** `src/config/SYSTEM_MESSAGE_CORA.md` (parseo: primer bloque entre \`\`\` o archivo completo según implementación).
- **Política:** lectura/consulta de contexto de negocio; el prompt define bloques (RIESGOS, PROCESOS, CONTROLES, PLANES) y tono.
- Cualquier cambio de comportamiento del asistente → actualizar **SYSTEM_MESSAGE_CORA.md** y esta sección si cambia el contrato HTTP o dependencias.

---

## 9. Frontend hermano

Repo **`gestion-riesgos-app`**: `VITE_API_BASE_URL` debe apuntar a `http://localhost:8080/api` (o URL desplegada). CORS debe permitir el origen del front.

---

## 10. Mantenimiento de este documento

Regla **`.cursor/rules/documentacion.mdc`**: ante cambios de código, actualizar **`context.md`** (y README solo si cambian comandos de arranque). No duplicar en otros `.md` salvo el prompt CORA en su path fijo.
