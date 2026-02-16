# Scripts de Prueba y Verificación

Este directorio contiene scripts SQL para probar y verificar las calificaciones de riesgos en la base de datos.

## Scripts Disponibles

### 1. `test_rapido.sql` ⚡
**Uso:** Verificación rápida del estado de las calificaciones.

**Qué hace:**
- Muestra un resumen de riesgos por nivel (lo que debería aparecer en el gráfico)
- Lista los primeros 10 riesgos con sus calificaciones
- Verifica si hay riesgos sin calificar
- Identifica riesgos con causas pero sin calificación correcta

**Cuándo usarlo:**
- Para verificar rápidamente si las calificaciones están correctas
- Antes y después de ejecutar `fix_calificaciones_completo.sql`
- Para diagnosticar por qué no aparecen datos en los gráficos

**Cómo ejecutarlo:**
```sql
-- En pgAdmin o cualquier cliente PostgreSQL:
-- Copia y pega el contenido del archivo y ejecuta
```

### 2. `test_calificaciones.sql` 🔍
**Uso:** Análisis detallado de todas las calificaciones.

**Qué hace:**
- Muestra todos los riesgos con sus evaluaciones completas
- Analiza las causas y sus calificaciones individuales
- Calcula la calificación máxima por riesgo y la compara con la guardada
- Verifica que los niveles de riesgo coincidan con las calificaciones

**Cuándo usarlo:**
- Para un análisis profundo de los datos
- Cuando necesites entender por qué una calificación específica es incorrecta
- Para verificar la lógica de cálculo de calificaciones

### 3. `fix_calificaciones_completo.sql` 🔧
**Uso:** Corregir y calcular todas las calificaciones.

**Qué hace:**
- Añade columnas faltantes si no existen
- Calcula la calificación inherente global para todos los riesgos
- Actualiza los niveles de riesgo según los umbrales correctos
- Calcula probabilidad e impacto para el mapa

**Cuándo usarlo:**
- Cuando las calificaciones no estén calculadas
- Después de añadir nuevas causas a los riesgos
- Cuando necesites recalcular todas las calificaciones

## Flujo de Trabajo Recomendado

1. **Primero:** Ejecuta `test_rapido.sql` para ver el estado actual
2. **Si hay problemas:** Ejecuta `fix_calificaciones_completo.sql` para corregir
3. **Después:** Ejecuta `test_rapido.sql` nuevamente para verificar que se corrigió
4. **Si necesitas más detalles:** Ejecuta `test_calificaciones.sql` para análisis profundo

## Interpretación de Resultados

### Resumen por Nivel
El primer query de `test_rapido.sql` debería mostrar algo como:
```
nivel_riesgo  | cantidad
--------------|----------
Crítico       | 4
Alto          | 5
Medio         | 3
Bajo          | 2
Sin Calificar | 0
```

**Esto es exactamente lo que debería aparecer en el gráfico de calificaciones del dashboard.**

### Riesgos Sin Calificar
Si el tercer query muestra `riesgos_sin_calificar > 0`, significa que hay riesgos que necesitan ser procesados. Ejecuta `fix_calificaciones_completo.sql` para corregirlos.

### Riesgos con Causas pero Sin Calificación
Si el cuarto query muestra resultados, significa que hay riesgos con causas pero sin calificación calculada. Esto puede pasar si:
- Se añadieron causas después de la última ejecución del script de corrección
- El script de corrección no se ejecutó completamente
- Hay un error en los datos (causas sin frecuencia, etc.)

## Solución de Problemas

### Problema: El gráfico no muestra datos
1. Ejecuta `test_rapido.sql` query 1
2. Si muestra 0 en todos los niveles, ejecuta `fix_calificaciones_completo.sql`
3. Vuelve a ejecutar `test_rapido.sql` para verificar

### Problema: Los datos no coinciden con el dashboard
1. Verifica que estés conectado a la base de datos correcta (producción vs desarrollo)
2. Ejecuta `test_calificaciones.sql` para ver los datos detallados
3. Compara los resultados con lo que ves en el dashboard

### Problema: Calificaciones incorrectas
1. Ejecuta `test_calificaciones.sql` query 4 para ver discrepancias
2. Verifica que las causas tengan frecuencia válida
3. Ejecuta `fix_calificaciones_completo.sql` para recalcular

## Notas Importantes

- ⚠️ **NO ejecutes `fix_calificaciones_completo.sql` en producción sin hacer backup primero**
- ✅ Los scripts de prueba (`test_*.sql`) son de solo lectura y seguros
- 🔄 Si añades nuevas causas, necesitarás recalcular las calificaciones
- 📊 El dashboard se actualiza automáticamente cuando guardas/editas causas

