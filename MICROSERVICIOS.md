# Backend: modo monolito

El backend corre en **un solo proceso** (monolito). Todas las rutas se sirven desde `npm start`.

- **Desarrollo:** `npm run dev`
- **Producción:** `npm run build` y luego `npm start`

El servidor escucha en el puerto definido en `PORT` (por defecto 8080). Ver **DEPLOY-VM-REDUCIDA.md** para desplegar en una VM con pocos recursos.
