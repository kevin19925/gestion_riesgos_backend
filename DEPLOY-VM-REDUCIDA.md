# Despliegue en VM con pocos recursos (ej. 2 CPU, 4 GB RAM)

En una máquina virtual con **2 CPUs** y **~4 GB de RAM** (como tu Azure VM) **no es recomendable** levantar los 5 procesos de microservicios (gateway + 4 servicios). Cada proceso Node puede usar 100–300 MB; entre todos podrías superar la RAM y saturar la VM.

## Recomendación: usar solo el monolito

En esta VM conviene ejecutar **un solo proceso**: el backend en modo **monolito**. Así todo el API corre en un único proceso y se mantiene el consumo de memoria bajo.

### Pasos en la VM (Azure / Linux)

1. **Build** (en tu máquina o en la VM):
   ```bash
   npm ci
   npm run build
   ```

2. **Variables de entorno** (`.env` en la raíz del proyecto):
   - `PORT=8080` (o el que uses; si usas nginx como proxy, puede ser 8080 interno).
   - `DATABASE_URL`, `JWT_SECRET`, y el resto que ya uses.

3. **Arrancar solo el monolito**:
   ```bash
   npm start
   ```
   o, explícitamente:
   ```bash
   node dist/index.js
   ```

4. (Opcional) **Proceso persistente con systemd**  
   Crea `/etc/systemd/system/gestion-riesgos-api.service` (ajusta rutas y usuario):

   ```ini
   [Unit]
   Description=Gestion Riesgos API (monolito)
   After=network.target

   [Service]
   Type=simple
   User=azureuser
   WorkingDirectory=/ruta/al/gestion_riesgos_backend
   Environment=NODE_ENV=production
   Environment=PORT=8080
   EnvironmentFile=/ruta/al/gestion_riesgos_backend/.env
   ExecStart=/usr/bin/node dist/index.js
   Restart=on-failure
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

   Luego:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable gestion-riesgos-api
   sudo systemctl start gestion-riesgos-api
   ```

### Qué NO hacer en esta VM

- No ejecutar los 5 procesos de microservicios (`start:gateway`, `start:auth`, etc.) en la misma VM.
- Reservar los microservicios para cuando tengas más RAM (por ejemplo ≥ 8 GB) o varias VMs.

### Muchos riesgos / mucha información

- El backend ya usa **paginación** en listados de riesgos (y planes, etc.), así que aunque haya muchos registros no se cargan todos de golpe.
- Si la VM va justa de RAM, puedes bajar el límite de **Node** con:
  ```bash
  NODE_OPTIONS="--max-old-space-size=1536" node dist/index.js
  ```
  (1536 MB de techo para el heap de Node; ajusta según lo que dejes para sistema y base de datos.)

### Resumen

| Recurso VM      | Recomendación                          |
|-----------------|----------------------------------------|
| 2 CPU, ~4 GB RAM| **Solo monolito** (`npm start`)        |
| ≥ 8 GB RAM      | Valorar gateway + 2–3 servicios        |
| Varias VMs      | Gateway en una VM, servicios en otras  |

En tu caso (pocos usuarios, muchos riesgos posibles): **despliega solo el monolito** en esta VM para no saturarla.
