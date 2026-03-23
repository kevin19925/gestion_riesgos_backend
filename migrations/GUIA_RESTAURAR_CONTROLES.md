# Guía: Restaurar Controles desde Backup Pre-Migración

**Objetivo**: Restaurar los controles reales que existían antes de la migración, preservando todas las evaluaciones y datos originales.

---

## 📋 Requisitos Previos

- ✅ Backup completo antes de la migración: `riesgosdb_antes_migracion`
- ✅ PostgreSQL instalado y accesible
- ✅ Credenciales de administrador de PostgreSQL
- ✅ Base de datos actual: `riesgos_db`

---

## 🚀 Paso 1: Restaurar Backup a Base de Datos Temporal

Ejecuta el script PowerShell:

```powershell
cd gestion_riesgos_backend/migrations
.\restaurar_backup_completo.ps1
```

**¿Qué hace este script?**
1. Crea una base de datos temporal: `temp_backup_pre_migracion`
2. Restaura el backup completo en esa base de datos
3. Verifica la estructura y muestra estadísticas
4. Muestra ejemplos de controles encontrados

**Salida esperada:**
```
✅ Backup restaurado exitosamente
Estadísticas de controles en el backup:
  total_causas: 283
  con_puntaje_total: 150  (ejemplo)
  con_evaluacion: 150
  con_descripcion: 150
```

---

## 🔧 Paso 2: Migrar Controles a la Base de Datos Actual

Abre **pgAdmin** y:

1. Conéctate a la base de datos **riesgos_db** (la actual)
2. Abre el archivo: `migrar_controles_desde_backup_completo.sql`
3. Ejecuta el script completo

**¿Qué hace este script?**
1. Conecta a la base de datos temporal usando `dblink`
2. Extrae los controles del backup (campos legacy de `CausaRiesgo`)
3. Los inserta en la tabla `ControlRiesgo` actual
4. Solo migra causas que existen en ambas bases de datos
5. No duplica controles (verifica que no existan)

**Salida esperada:**
```
INSERT 0 150  (número de controles migrados)

Controles migrados: 150
```

---

## ✅ Paso 3: Verificar Migración Exitosa

Ejecuta estos queries en **riesgos_db**:

```sql
-- 1. Contar controles migrados
SELECT COUNT(*) FROM "ControlRiesgo";
-- Debe mostrar > 0

-- 2. Ver ejemplos de controles
SELECT 
    id,
    "causaRiesgoId",
    descripcion,
    "tipoControl",
    "puntajeControl",
    "evaluacionDefinitiva"
FROM "ControlRiesgo"
LIMIT 10;

-- 3. Ver estadísticas por tipo
SELECT 
    "tipoControl",
    COUNT(*) as total,
    ROUND(AVG("puntajeControl"), 2) as puntaje_promedio
FROM "ControlRiesgo"
GROUP BY "tipoControl";
```

---

## 🌐 Paso 4: Verificar en la Interfaz

1. **Refrescar token**: Cerrar sesión y volver a entrar
2. **Recargar página**: F5 en "Controles y Planes de Acción"
3. **Ir a pestaña "CONTROLES"**
4. **Verificar que aparecen los controles**

**Logs esperados en la consola del navegador:**
```
🔵 [CAUSA] {
  causaId: 231,
  tipoGestion: "CONTROL",
  tieneControles: true,
  controlesLength: 1,        // ← Ahora tiene controles
  tipoCalculado: "CONTROL"
}

🔍 [CONTROLES] Resultado final: X riesgos con controles  (X > 0)
```

---

## 🧹 Paso 5: Limpiar Base de Datos Temporal (Opcional)

Una vez verificado que todo funciona:

```powershell
dropdb -h localhost -U postgres temp_backup_pre_migracion
```

---

## 📊 Datos Migrados

Los controles migrados incluyen:

| Campo | Origen en Backup | Destino en Actual |
|-------|------------------|-------------------|
| Descripción | CausaRiesgo.controlDescripcion | ControlRiesgo.descripcion |
| Tipo | CausaRiesgo.controlTipo | ControlRiesgo.tipoControl |
| Responsable | CausaRiesgo.controlResponsable | ControlRiesgo.responsable |
| Aplicabilidad | CausaRiesgo.aplicabilidad | ControlRiesgo.aplicabilidad |
| Cobertura | CausaRiesgo.cobertura | ControlRiesgo.cobertura |
| Facilidad de Uso | CausaRiesgo.facilidadUso | ControlRiesgo.facilidadUso |
| Segregación | CausaRiesgo.segregacion | ControlRiesgo.segregacion |
| Naturaleza | CausaRiesgo.naturaleza | ControlRiesgo.naturaleza |
| Desviaciones | CausaRiesgo.desviaciones | ControlRiesgo.desviaciones |
| Puntaje | CausaRiesgo.puntajeTotal | ControlRiesgo.puntajeControl |
| Evaluación Preliminar | CausaRiesgo.evaluacionPreliminar | ControlRiesgo.evaluacionPreliminar |
| Evaluación Definitiva | CausaRiesgo.evaluacionDefinitiva | ControlRiesgo.evaluacionDefinitiva |
| % Mitigación | CausaRiesgo.porcentajeMitigacion | ControlRiesgo.estandarizacionPorcentajeMitigacion |
| Tipo Mitigación | CausaRiesgo.tipoMitigacion | ControlRiesgo.tipoMitigacion |
| Recomendación | CausaRiesgo.recomendacion | ControlRiesgo.recomendacion |

---

## 🔍 Solución de Problemas

### Error: "database temp_backup_pre_migracion does not exist"

**Causa**: No se ejecutó el Paso 1 correctamente

**Solución**: Ejecutar `restaurar_backup_completo.ps1` primero

---

### Error: "extension dblink does not exist"

**Causa**: La extensión dblink no está instalada

**Solución**: Ejecutar como superusuario:
```sql
CREATE EXTENSION dblink;
```

---

### Error: "could not establish connection"

**Causa**: No se puede conectar a la base de datos temporal

**Solución**: Verificar que existe:
```sql
SELECT datname FROM pg_database WHERE datname = 'temp_backup_pre_migracion';
```

---

### No se migran controles (INSERT 0 0)

**Causa**: Las causas del backup no coinciden con las actuales

**Solución**: Verificar IDs de causas:
```sql
-- En temp_backup_pre_migracion
SELECT id FROM "CausaRiesgo" WHERE "puntajeTotal" IS NOT NULL LIMIT 5;

-- En riesgos_db
SELECT id FROM "CausaRiesgo" LIMIT 5;
```

Si los IDs no coinciden, puede ser que las causas se hayan recreado. En ese caso, necesitarás un mapeo más complejo.

---

## ✅ Checklist Final

- [ ] Ejecutar `restaurar_backup_completo.ps1`
- [ ] Verificar que se creó `temp_backup_pre_migracion`
- [ ] Ver estadísticas de controles en el backup
- [ ] Ejecutar `migrar_controles_desde_backup_completo.sql` en pgAdmin
- [ ] Verificar que se insertaron controles: `SELECT COUNT(*) FROM "ControlRiesgo";`
- [ ] Refrescar token (cerrar sesión y volver a entrar)
- [ ] Recargar página y verificar pestaña "CONTROLES"
- [ ] Verificar que los datos son correctos (puntajes, evaluaciones)
- [ ] Eliminar base de datos temporal (opcional)

---

## 🎉 Resultado Esperado

Después de completar estos pasos:

- ✅ Tabla `ControlRiesgo` tiene los controles reales del backup
- ✅ Todos los puntajes y evaluaciones están preservados
- ✅ La pestaña "CONTROLES" muestra los controles
- ✅ Los datos son los originales, no inventados
- ✅ El sistema funciona como antes de la migración

---

**Fecha**: 2026-03-23  
**Estado**: ✅ LISTO PARA EJECUTAR
