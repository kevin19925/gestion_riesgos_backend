# 🔌 Conectar pgAdmin a la Base de Datos Azure

## 📋 Datos de Conexión

Según tu archivo `.env`, estos son los datos de conexión:

```
Host: data-base-src.postgres.database.azure.com
Port: 5432
Database: riesgos_db
Username: azureuser
Password: EnyOcyBZ#
SSL Mode: require
```

---

## 🚀 Pasos para Conectar en pgAdmin

### Paso 1: Abrir pgAdmin

1. Abre **pgAdmin 4**
2. Si te pide contraseña maestra, ingrésala

### Paso 2: Crear Nueva Conexión

1. Clic derecho en **Servers** (en el panel izquierdo)
2. Selecciona **Register** → **Server...**

### Paso 3: Pestaña "General"

- **Name**: `Azure - Riesgos DB` (o el nombre que prefieras)
- **Server group**: Servers (o crea uno nuevo)
- **Comments**: Base de datos de producción - Gestión de Riesgos

### Paso 4: Pestaña "Connection"

Ingresa estos datos EXACTAMENTE:

```
Host name/address: data-base-src.postgres.database.azure.com
Port: 5432
Maintenance database: riesgos_db
Username: azureuser
Password: EnyOcyBZ#
```

✅ **Marca la casilla**: "Save password?" (para no tener que ingresarla cada vez)

### Paso 5: Pestaña "SSL"

**IMPORTANTE**: Azure PostgreSQL requiere SSL

```
SSL mode: Require
```

Deja los demás campos en blanco.

### Paso 6: Pestaña "Advanced" (Opcional)

Si la conexión es lenta, puedes agregar:

```
DB restriction: riesgos_db
```

Esto evita que pgAdmin liste otras bases de datos.

### Paso 7: Guardar y Conectar

1. Clic en **Save**
2. pgAdmin intentará conectarse automáticamente
3. Si todo está bien, verás el servidor expandido con la base de datos `riesgos_db`

---

## ✅ Verificar Conexión Exitosa

Una vez conectado, deberías ver:

```
Servers
  └─ Azure - Riesgos DB
      └─ Databases (1)
          └─ riesgos_db
              ├─ Schemas
              │   └─ public
              │       ├─ Tables (50+)
              │       ├─ Views
              │       └─ Functions
              └─ ...
```

---

## 🔍 Verificar que Estás en la BD Correcta

Ejecuta esta query para confirmar:

```sql
-- Debe retornar: riesgos_db
SELECT current_database();

-- Debe retornar: azureuser
SELECT current_user;

-- Debe retornar lista de tablas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name
LIMIT 10;
```

---

## ❌ Problemas Comunes

### Error: "could not connect to server"

**Causa**: Firewall de Azure bloqueando tu IP

**Solución**:
1. Ve al portal de Azure
2. Busca tu servidor PostgreSQL: `data-base-src`
3. Ve a **Connection security** o **Networking**
4. Agrega tu IP pública a la lista de IPs permitidas
5. Guarda los cambios y espera 1-2 minutos

### Error: "password authentication failed"

**Causa**: Contraseña incorrecta o caracteres especiales

**Solución**:
- La contraseña es: `EnyOcyBZ#` (con el símbolo #)
- Si no funciona, verifica en el portal de Azure
- Puede que necesites resetear la contraseña

### Error: "SSL connection required"

**Causa**: No configuraste SSL mode

**Solución**:
- En la pestaña SSL, selecciona **Require**
- Guarda y reconecta

### Error: "timeout"

**Causa**: Conexión lenta o servidor ocupado

**Solución**:
- Aumenta el timeout en pgAdmin: File → Preferences → Binary paths → Connection timeout: 60
- Verifica tu conexión a internet

---

## 🔐 Seguridad

⚠️ **IMPORTANTE**:
- Esta es una base de datos de **PRODUCCIÓN**
- Ten mucho cuidado con queries DELETE o UPDATE sin WHERE
- Siempre haz backup antes de modificar datos
- Usa transacciones (BEGIN/COMMIT) para cambios importantes

---

## 📊 Próximos Pasos

Una vez conectado:

1. ✅ Ejecuta `diagnostico_tablas.sql` para ver el estado de las tablas
2. ✅ Ejecuta `buscar_riesgo_3GAD.sql` para encontrar tus datos
3. ✅ Verifica que las tablas PlanAccion y Control existen
4. ✅ Procede con la migración si todo está correcto

---

## 🆘 Si Nada Funciona

Si no puedes conectarte después de intentar todo:

1. Verifica que tienes acceso al portal de Azure
2. Confirma que el servidor PostgreSQL está activo
3. Revisa los logs de conexión en Azure
4. Contacta al administrador de Azure para verificar permisos

