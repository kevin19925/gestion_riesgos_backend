# 📋 Fase 1: Migración de Base de Datos - Explicación Detallada

## ✅ ¿Qué hace esta migración?

Esta migración agrega campos nuevos a las tablas existentes para soportar la trazabilidad entre Planes de Acción y Controles.

## 🔍 Cambios Específicos

### 1. Tabla `PlanAccion` (2 campos nuevos)

```sql
ALTER TABLE "PlanAccion" ADD COLUMN "controlDerivadoId" INTEGER;
ALTER TABLE "PlanAccion" ADD COLUMN "fechaConversion" TIMESTAMP(3);
```

**¿Qué significa?**
- `controlDerivadoId`: Guarda el ID del control que se creó desde este plan (si fue convertido)
- `fechaConversion`: Guarda cuándo se hizo la conversión

**¿Es seguro?**
- ✅ Ambos campos son **opcionales (NULL)**
- ✅ Planes existentes quedarán con estos campos en NULL
- ✅ No afecta funcionalidad actual

---

### 2. Tabla `Control` (2 campos nuevos)

```sql
ALTER TABLE "Control" ADD COLUMN "planAccionOrigenId" INTEGER;
ALTER TABLE "Control" ADD COLUMN "fechaCreacionDesdePlan" TIMESTAMP(3);
```

**¿Qué significa?**
- `planAccionOrigenId`: Guarda el ID del plan que originó este control (si fue creado desde un plan)
- `fechaCreacionDesdePlan`: Guarda cuándo se creó desde el plan

**¿Es seguro?**
- ✅ Ambos campos son **opcionales (NULL)**
- ✅ Controles existentes quedarán con estos campos en NULL
- ✅ No afecta funcionalidad actual

---

### 3. Nueva Tabla `AlertaVencimiento`

```sql
CREATE TABLE "AlertaVencimiento" (
    id, planAccionId, usuarioId, tipo, diasRestantes, 
    leida, fechaGeneracion, fechaLectura, ...
)
```

**¿Qué significa?**
- Tabla completamente nueva para gestionar alertas de vencimiento
- No afecta ninguna tabla existente

**¿Es seguro?**
- ✅ Es una tabla **nueva**, no modifica nada existente
- ✅ Empieza vacía
- ✅ No afecta funcionalidad actual

---

### 4. Índices (Para Optimización)

```sql
CREATE INDEX "PlanAccion_estado_idx" ON "PlanAccion"("estado");
CREATE INDEX "PlanAccion_fechaProgramada_idx" ON "PlanAccion"("fechaProgramada");
-- ... más índices
```

**¿Qué significa?**
- Mejoran la velocidad de consultas por estado y fecha
- No modifican datos

**¿Es seguro?**
- ✅ Los índices solo **mejoran performance**
- ✅ No afectan datos ni funcionalidad

---

### 5. Foreign Keys (Relaciones)

```sql
ALTER TABLE "PlanAccion" ADD CONSTRAINT "PlanAccion_controlDerivadoId_fkey" 
    FOREIGN KEY ("controlDerivadoId") REFERENCES "Control"("id");

ALTER TABLE "Control" ADD CONSTRAINT "Control_planAccionOrigenId_fkey" 
    FOREIGN KEY ("planAccionOrigenId") REFERENCES "PlanAccion"("id");
```

**¿Qué significa?**
- Asegura que los IDs referenciados existan
- Mantiene integridad referencial

**¿Es seguro?**
- ✅ Como los campos son NULL, no hay validación que falle
- ✅ Solo aplica cuando se usen los campos nuevos

---

## 🛡️ Garantías de Seguridad

### ✅ NO se elimina nada
- No se eliminan tablas
- No se eliminan columnas
- No se eliminan datos

### ✅ NO se modifica nada existente
- Datos actuales permanecen intactos
- Funcionalidad actual sigue funcionando
- Código existente no requiere cambios

### ✅ TODO es opcional
- Campos nuevos son nullable
- Tabla nueva empieza vacía
- Relaciones son opcionales

### ✅ Reversible
- Incluye script de ROLLBACK completo
- Puedes revertir en cualquier momento

---

## 📊 Impacto en Datos Existentes

### Antes de la migración:
```
PlanAccion: 50 registros
Control: 30 registros
```

### Después de la migración:
```
PlanAccion: 50 registros (sin cambios)
  - controlDerivadoId: NULL en todos
  - fechaConversion: NULL en todos

Control: 30 registros (sin cambios)
  - planAccionOrigenId: NULL en todos
  - fechaCreacionDesdePlan: NULL en todos

AlertaVencimiento: 0 registros (tabla nueva vacía)
```

---

## 🚀 Pasos para Aplicar la Migración

### Opción 1: Aplicar con Prisma (Recomendado)

```bash
cd gestion_riesgos_backend
npx prisma migrate deploy
```

### Opción 2: Aplicar SQL Manualmente

```bash
# Conectarse a la base de datos
psql -h [host] -U [usuario] -d riesgos_db

# Ejecutar el archivo SQL
\i migrations/add_plan_trazabilidad.sql
```

### Opción 3: Usar herramienta GUI (Azure Data Studio, pgAdmin, etc.)
1. Abrir el archivo `add_plan_trazabilidad.sql`
2. Copiar el contenido
3. Ejecutar en la herramienta

---

## ✅ Verificación Post-Migración

Después de aplicar, ejecuta estas queries para verificar:

```sql
-- 1. Verificar columnas nuevas en PlanAccion
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'PlanAccion' 
  AND column_name IN ('controlDerivadoId', 'fechaConversion');

-- 2. Verificar columnas nuevas en Control
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Control' 
  AND column_name IN ('planAccionOrigenId', 'fechaCreacionDesdePlan');

-- 3. Verificar tabla AlertaVencimiento
SELECT COUNT(*) FROM "AlertaVencimiento";

-- 4. Verificar que datos existentes no cambiaron
SELECT COUNT(*) FROM "PlanAccion";
SELECT COUNT(*) FROM "Control";
```

**Resultados esperados:**
- ✅ 4 columnas nuevas creadas (todas nullable)
- ✅ Tabla AlertaVencimiento existe y está vacía
- ✅ Conteos de PlanAccion y Control sin cambios

---

## 🔄 Rollback (Si Necesitas Revertir)

Si algo sale mal o quieres revertir, ejecuta la sección de ROLLBACK del archivo SQL:

```sql
-- Descomentar y ejecutar la sección ROLLBACK del archivo
-- add_plan_trazabilidad.sql
```

Esto eliminará todos los cambios y dejará la base de datos como estaba antes.

---

## ⚠️ Recomendaciones Antes de Aplicar

1. **Hacer backup de la base de datos**
   ```bash
   pg_dump -h [host] -U [usuario] -d riesgos_db > backup_antes_migracion.sql
   ```

2. **Probar primero en ambiente de desarrollo**
   - No aplicar directamente en producción
   - Validar en dev/staging primero

3. **Revisar el SQL generado**
   - Abre `add_plan_trazabilidad.sql`
   - Lee cada comando
   - Asegúrate de entender qué hace

4. **Tener plan de rollback listo**
   - El script incluye sección de rollback
   - Prueba el rollback en dev antes

---

## 📞 Siguiente Paso

Una vez aplicada la migración exitosamente:
1. Verificar que todo funcionó con las queries de verificación
2. Confirmar que la aplicación sigue funcionando normalmente
3. Proceder con **Fase 2: Script de Migración de Datos** (asignar estados a planes existentes)

---

## ❓ Preguntas Frecuentes

**P: ¿Puedo aplicar esto en producción directamente?**
R: NO. Primero prueba en desarrollo, luego en staging, y finalmente en producción.

**P: ¿Qué pasa si algo sale mal?**
R: Ejecuta el script de ROLLBACK incluido en el archivo SQL.

**P: ¿Afectará a los usuarios actuales?**
R: NO. La aplicación seguirá funcionando exactamente igual.

**P: ¿Cuánto tiempo toma?**
R: Menos de 1 segundo. Son solo ALTER TABLE y CREATE TABLE.

**P: ¿Necesito detener la aplicación?**
R: NO es necesario, pero es recomendable en producción para evitar inconsistencias.
