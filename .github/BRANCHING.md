# Ramas y flujo (gestion_riesgos_backend)

## Por qué se rompía producción

El workflow **Deploy Empresa** corre en **cada push a `main`**. Sin CI en PR ni rama de integración, los errores pueden llegar directo al servidor.

## Ramas previstas

| Rama      | Uso |
|-----------|-----|
| `develop` | Integración: PR de features/fixes antes de producción. |
| `main`    | Línea estable / despliegue. Entradas vía PR desde `develop` (o hotfix acordado). |

## Flujo recomendado

1. `git checkout develop && git pull && git checkout -b fix/mi-cambio`
2. PR hacia **`develop`**. Workflow **CI** en verde.
3. Release: PR **`develop` → `main`**. El merge dispara el deploy actual.

## GitHub (recomendado)

**Settings → Branches**: proteger **`main`** y **`develop`** con “Require status checks” → job **CI / build**.

## Tests

`npm test` no está incluido en CI por defecto (puede requerir base de datos). El CI actual ejecuta **lint** y **`npm run build`** (Prisma + `tsc`).
