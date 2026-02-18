# 🔄 Migración: Múltiples Responsables por Proceso

## 📋 Descripción

Este script migra el sistema para soportar **múltiples responsables por proceso** sin perder ningún dato existente.

## ✅ Lo que hace el script

1. **Crea la tabla `ProcesoResponsable`** (relación muchos-a-muchos)
2. **Migra los datos existentes** de `responsableId` a la nueva tabla
3. **Mantiene el campo `responsableId`** por compatibilidad (NO se borra)
4. **Verifica la migración** mostrando estadísticas

## 🚀 Cómo ejecutar

### Opción 1: Desde pgAdmin

1. Abre pgAdmin
2. Conéctate a tu base de datos
3. Abre el Query Tool
4. Copia y pega el contenido de `migrar_responsables_multiples.sql`
5. Ejecuta el script (F5)

### Opción 2: Desde línea de comandos

```bash
psql -h tu_host -U tu_usuario -d tu_base_de_datos -f scripts/migrar_responsables_multiples.sql
```

## ⚠️ Importante

- **NO se borran datos**: El campo `responsableId` se mantiene intacto
- **NO se pierden responsables**: Todos los responsables existentes se migran a la nueva tabla
- **Es seguro ejecutar múltiples veces**: El script usa `ON CONFLICT DO NOTHING` para evitar duplicados

## 📊 Verificación

Después de ejecutar el script, verifica:

1. **Procesos con responsableId original:**
   ```sql
   SELECT COUNT(*) FROM "Proceso" WHERE "responsableId" IS NOT NULL;
   ```

2. **Responsables migrados:**
   ```sql
   SELECT COUNT(*) FROM "ProcesoResponsable";
   ```

3. **Procesos con múltiples responsables:**
   ```sql
   SELECT "procesoId", COUNT(*) as cantidad
   FROM "ProcesoResponsable"
   GROUP BY "procesoId"
   HAVING COUNT(*) > 1;
   ```

## 🔄 Después de la migración

1. Ejecuta `npx prisma generate` para actualizar el cliente de Prisma
2. Reinicia el servidor backend
3. Actualiza el frontend para usar la nueva funcionalidad

## 📝 Notas

- El campo `responsableId` se mantiene por compatibilidad con código existente
- La nueva tabla `ProcesoResponsable` es la fuente de verdad para múltiples responsables
- Puedes tener tanto `responsableId` como múltiples responsables en `ProcesoResponsable` simultáneamente

