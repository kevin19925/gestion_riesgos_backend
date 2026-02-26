# Despliegue en Azure: Backend y Frontend en máquinas distintas

## Máquina 1: Backend (API)

### Habilitar en la VM
- **Docker** y **Docker Compose** instalados (ya lo tienes si `docker compose up` funciona).
- **Puerto 8080** abierto:
  - En el **firewall de la VM** (Ubuntu: `sudo ufw allow 8080 && sudo ufw reload`, o equivalente).
  - En **Azure** → Grupo de seguridad de red (NSG) de la VM → Regla de entrada: permitir TCP **8080** desde:
    - La IP pública de la VM del frontend, o
    - Internet (0.0.0.0/0) si el frontend y los usuarios acceden por internet.

### Variables de entorno (`.env` en `~/app-empresa`)
```env
DATABASE_URL=postgresql://usuario:password@host:puerto/base
REDIS_URL=redis://host:6379
PORT=8080
# URL del frontend (para CORS). Ejemplo: https://tu-frontend.azure.com o http://IP_PUBLICA_FRONTEND
CORS_ORIGIN=https://tu-dominio-frontend.com
```
Si tienes varias URLs de frontend, puedes separarlas por coma y habría que soportarlo en código; por ahora el backend en producción acepta cualquier origen.

### Resumen Backend
| Qué | Dónde |
|-----|--------|
| Puerto 8080 | Firewall VM + NSG Azure (entrada TCP 8080) |
| Docker + Compose | Instalados en la VM |
| DATABASE_URL, REDIS_URL, CORS_ORIGIN | `.env` en la carpeta del proyecto |

---

## Máquina 2: Frontend (React / Vite)

### Habilitar en la VM
- **Node.js** (v18+) para hacer el build, o **Docker** si sirves el build con una imagen.
- **Puerto 80** (HTTP) y, si usas HTTPS, **443**:
  - Firewall de la VM: `sudo ufw allow 80` (y `443` si aplica), `sudo ufw reload`.
  - Azure NSG: reglas de entrada TCP **80** y **443** desde Internet (0.0.0.0/0) o según necesidad.

### Build del frontend
El frontend debe construirse con la URL del **backend** (la otra máquina):

```bash
cd gestion-riesgos-app
# Crear .env.production con la URL pública del backend
echo "VITE_API_BASE_URL=https://IP-O-DOMINIO-BACKEND:8080/api" > .env.production
# Si el backend está en HTTP (sin SSL): http://IP-BACKEND:8080/api
npm ci
npm run build
```

Sustituye `IP-O-DOMINIO-BACKEND` por la **IP pública** o el **dominio** de la VM del backend (ej: `http://20.123.45.67:8080/api` o `https://api.tudominio.com/api`).

### Servir los archivos estáticos
- **Opción A – Nginx (recomendado):**
  - Instalar nginx, apuntar `root` a la carpeta `dist` del build (ej: `/var/www/gestion-riesgos-app/dist`).
  - Configurar server en puerto 80 (y 443 si usas SSL).
- **Opción B – Servir con Node:**
  - `npx serve -s dist -l 80`
- **Opción C – Docker:**
  - Imagen tipo `nginx:alpine` que copie `dist` y sirva en 80.

### Resumen Frontend
| Qué | Dónde |
|-----|--------|
| Puerto 80 (y 443 si HTTPS) | Firewall VM + NSG Azure |
| VITE_API_BASE_URL | `.env.production` **antes del build** = URL completa del backend (ej: `http://IP-BACKEND:8080/api`) |
| Archivos estáticos | Carpeta `dist` servida por nginx/serve/Docker en 80/443 |

---

## Comprobación rápida

- **Backend:**  
  `curl http://IP-BACKEND:8080/api/health`  
  Debe responder OK (no 404).

- **Frontend:**  
  Abrir en el navegador `http://IP-FRONTEND` (o el dominio). Al hacer login, las peticiones deben ir a la URL configurada en `VITE_API_BASE_URL` (backend en la otra máquina).

---

## Resumen de puertos en Azure NSG

| Máquina  | Puerto | Origen recomendado |
|----------|--------|--------------------|
| Backend  | 8080   | IP del frontend o 0.0.0.0/0 |
| Frontend | 80     | 0.0.0.0/0 (usuarios finales) |
| Frontend | 443    | 0.0.0.0/0 (si usas HTTPS) |
