# 📦 Explicación: Almacenamiento de Archivos

## 🎯 ¿Qué es Azure Blob Storage?

Azure Blob Storage es un servicio de almacenamiento en la nube de Microsoft para guardar archivos (PDFs, imágenes, documentos, etc.). Es como un "disco duro en la nube".

### ¿Por qué NO guardar archivos en la base de datos?

❌ **Problemas de guardar archivos directamente en PostgreSQL:**
- La base de datos se vuelve muy pesada
- Las consultas son más lentas
- Los backups son enormes
- Cuesta más dinero en almacenamiento

✅ **Solución: Guardar solo la URL en la base de datos**
- El archivo físico se guarda en Azure Blob Storage
- En la base de datos solo guardas la URL (texto pequeño)
- Ejemplo: `https://bsistemariesgos.blob.core.windows.net/archivos/2024/01/15/abc123-documento.pdf`

## 📊 Estado Actual de tu Proyecto

### 1. **Azure Blob Storage YA está implementado** ✅

Archivo: `src/utils/azureBlob.ts`

```typescript
// Función para subir archivos
uploadToBlob(buffer, nombreArchivo, tipoContenido)
  → Retorna: { url: "https://...", blobName: "..." }

// Función para eliminar archivos
deleteBlobByUrl(url)
  → Elimina el archivo de Azure Blob
```

### 2. **Pero actualmente usa Cloudinary** ⚠️

Archivo: `src/routes/upload.routes.ts`

El sistema está configurado para usar **Cloudinary** (otro servicio de almacenamiento en la nube), NO Azure Blob.

## 🔄 ¿Qué debes hacer?

### Opción 1: Migrar de Cloudinary a Azure Blob (Recomendado)

Si te dieron credenciales de Azure Blob, deberías cambiar el código para usar Azure en lugar de Cloudinary.

**Ventajas:**
- Todo en el mismo ecosistema (Azure)
- Más control sobre los archivos
- Posiblemente más económico

**Pasos:**

1. **Verificar que las credenciales estén en el `.env`:**
   ```env
   AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=bsistemariesgos;..."
   AZURE_STORAGE_CONTAINER="archivos"
   ```

2. **Modificar `src/routes/upload.routes.ts`** para usar Azure Blob en lugar de Cloudinary

3. **Actualizar el frontend** para que siga funcionando con las nuevas URLs

### Opción 2: Mantener Cloudinary

Si Cloudinary ya está funcionando y no quieres cambiar, puedes seguir usándolo.

**Necesitas:**
- Credenciales de Cloudinary en el `.env`:
  ```env
  CLOUDINARY_CLOUD_NAME="tu-cloud-name"
  CLOUDINARY_API_KEY="tu-api-key"
  CLOUDINARY_API_SECRET="tu-api-secret"
  ```

## 📝 Cómo funciona actualmente

### Flujo de subida de archivos:

```
1. Usuario selecciona archivo en el frontend
   ↓
2. Frontend envía archivo a: POST /api/upload/archivo
   ↓
3. Backend recibe el archivo (multer en memoria)
   ↓
4. Backend sube a Cloudinary (actualmente)
   ↓
5. Cloudinary retorna URL: "https://res.cloudinary.com/..."
   ↓
6. Backend guarda solo la URL en PostgreSQL
   ↓
7. Frontend muestra el archivo usando la URL
```

### Ejemplo en la base de datos:

```sql
-- Tabla: Normatividad (ejemplo)
CREATE TABLE "Normatividad" (
  id SERIAL PRIMARY KEY,
  nombre TEXT,
  descripcion TEXT,
  archivoUrl TEXT,  -- ← Solo guarda la URL, NO el archivo
  createdAt TIMESTAMP
);

-- Registro ejemplo:
INSERT INTO "Normatividad" VALUES (
  1,
  'Ley 1581 de 2012',
  'Protección de datos personales',
  'https://res.cloudinary.com/gestion-riesgos/documento.pdf',  -- ← URL
  '2024-01-15'
);
```

## 🔧 ¿Qué necesitas hacer AHORA?

### 1. Verificar qué servicio quieren usar

Pregunta a tu equipo:
- ¿Quieren usar Azure Blob Storage? (te dieron credenciales)
- ¿O seguir con Cloudinary? (ya está implementado)

### 2. Si eligen Azure Blob Storage:

Te ayudo a modificar el código para usar Azure en lugar de Cloudinary.

### 3. Si eligen Cloudinary:

Solo necesitas las credenciales de Cloudinary en el `.env` de Azure.

## 📋 Resumen Simple

| Concepto | Explicación |
|----------|-------------|
| **Azure Blob** | Disco duro en la nube de Microsoft |
| **Cloudinary** | Disco duro en la nube alternativo (actual) |
| **URL** | Dirección web del archivo (ej: https://...) |
| **Base de datos** | Solo guarda la URL, NO el archivo |
| **Buffer** | Archivo en memoria antes de subirlo |
| **Multer** | Librería para recibir archivos en el backend |

## 🎯 Decisión Recomendada

**Usa Azure Blob Storage** porque:
1. Ya tienes las credenciales
2. El código ya está implementado (`azureBlob.ts`)
3. Todo queda en el mismo ecosistema Azure
4. Es más fácil de administrar

¿Quieres que te ayude a migrar de Cloudinary a Azure Blob?
