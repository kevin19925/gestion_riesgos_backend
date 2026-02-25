# Optimizaciones para consultas rápidas (Backend y Frontend)

## Backend

### 1. Índices en base de datos (Prisma)
- **Riesgo**: `@@index([procesoId])`, `@@index([createdAt])` — filtros por proceso y orden por fecha más rápidos.
- **CausaRiesgo**: `@@index([riesgoId])` — carga de causas por riesgo más rápida.
- **Incidencia**: `@@index([procesoId])`, `@@index([riesgoId])`, `@@index([fechaOcurrencia])` — listados y filtros más rápidos.

**Aplicar los índices cuando hay drift (DB no creada con migraciones):**

No uses `prisma migrate reset` (borraría todos los datos). En su lugar:

1. Ejecuta el script SQL que crea solo los índices nuevos:
   ```bash
   # Con psql (reemplaza con tu connection string):
   psql "postgresql://user:pass@host:5432/riesgos_db_cv8c?schema=public" -f scripts/add_indexes_consultas.sql
   ```
   O copia y ejecuta el contenido de `scripts/add_indexes_consultas.sql` en tu cliente SQL (DBeaver, Render SQL, etc.).

2. Regenera el cliente Prisma:
   ```bash
   npx prisma generate
   ```

Si tu base **sí** está gestionada solo por migraciones y no hay drift, entonces:
```bash
npx prisma migrate dev --name add_indexes_consultas
```

### 2. getRiesgos
- Filtro por `procesoId` en la query (ya existía).
- Paginación con `take`/`skip` (máx. 100 por página).
- Incluir causas solo cuando `includeCausas=true`, con límite por riesgo.

### 3. getPuntosMapa
- Si **no** se envía `procesoId`, se limita a 500 riesgos para no devolver miles.
- Solo se pide `proceso: { id, nombre, sigla }` (menos datos).
- No se incluyen causas (el mapa no las usa).

### 4. getIncidencias
- Límite de 200 incidencias por petición.
- Relaciones con `select` reducido: riesgo (id, descripcion, numeroIdentificacion, procesoId), proceso (id, nombre, sigla), responsable (id, nombre, email).

## Frontend

### 1. Parámetros de query
- En RTK Query, los parámetros `undefined`/`null` se eliminan antes de montar la URL (menos parámetros y caché más estable en getRiesgos y getIncidencias).

### 2. Filtro por proceso
- Donde aplica (dueño/supervisor), las pantallas envían `procesoId` para que el backend filtre y no se traigan todos los datos.

### 3. PageSize y caché
- PageSize acotado (100–200) en listados.
- `refetchOnMountOrArgChange: false` y `keepUnusedDataFor: 300–600` en varias queries para reutilizar datos y evitar peticiones innecesarias.
