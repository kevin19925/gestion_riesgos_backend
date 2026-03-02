# Pasos para que funcione bien: migración y recálculo residual

## 1. Aplicar migraciones (base de datos)

Desde la raíz del backend:

```bash
cd gestion_riesgos_backend
npx prisma migrate deploy
```

- **`migrate deploy`**: aplica todas las migraciones pendientes (recomendado en cualquier entorno).
- Si usas desarrollo local y quieres que Prisma cree la BD si no existe: `npx prisma migrate dev`.

La migración `20250224140000_add_porcentaje_reduccion_dimension_cruzada` añade la columna `porcentajeReduccionDimensionCruzada` en `ConfiguracionResidual` (valor entre 0 y 1; null = se usa 0.34 por defecto).

## 2. Regenerar el cliente Prisma

```bash
npx prisma generate
```

Así el cliente TypeScript conoce el nuevo campo y no hay errores de tipos.

## 3. Reiniciar el backend (si estaba corriendo)

Si el servidor Node estaba levantado, reinícialo para que cargue el nuevo cliente y el código que usa `getPorcentajeDimensionCruzada()`:

```bash
# Detener el proceso actual (Ctrl+C) y luego:
npm run dev
```

## 4. (Opcional) Configurar el porcentaje en Admin

1. Entra en **Admin → Configuración Residual**.
2. Pestaña **Pesos de Criterios**.
3. En **Parámetros generales** ajusta **Reducción dimensión cruzada (0-1)** (por defecto 0.34).
4. Guarda (se recalculan automáticamente los residuales con la nueva config).

## 5. Recalcular todo el mapa residual

Para dejar todas las calificaciones residuales y el mapa alineados con la config actual:

1. **Admin → Configuración Residual**.
2. Pulsa **Recalcular** (botón de reclasificación residual).

Eso:

- Recalcula todas las causas con control (CONTROL/AMBOS) con pesos, rangos, tabla de mitigación y porcentaje de dimensión cruzada de la config activa.
- Actualiza **todas** las evaluaciones de riesgo (`EvaluacionRiesgo`) para que el mapa residual use la causa de mayor CA por riesgo.

## Resumen rápido (copiar/pegar)

```bash
cd gestion_riesgos_backend
npx prisma migrate deploy
npx prisma generate
npm run dev
```

Luego en la app: Admin → Configuración Residual → (opcional) editar “Reducción dimensión cruzada” y guardar → **Recalcular**.
