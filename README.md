# COMWARE — Backend (gestión de riesgos)

API Express + Prisma para gestión de riesgos. **Contexto técnico completo (rutas, arquitectura, dominio, CORA, env):** [`context.md`](context.md).

---

## Inicio rápido

```bash
npm install
# Crear .env (ver context.md para variables)
npx prisma generate
npm run dev
```

- **Producción:** `npm run build` → `npm start`
- **Semillas:** `npm run seed` o `npm run seed:basic`

Cualquier cambio de contrato, configuración o dominio expuesto debe actualizarse también en **`context.md`** (y en `src/config/SYSTEM_MESSAGE_CORA.md` si toca CORA). Regla: `.cursor/rules/documentacion.mdc`.
