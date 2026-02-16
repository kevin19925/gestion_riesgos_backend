# 📁 Guía de Manejo de Archivos en Render

## ⚠️ Problema con Render

Render tiene un **sistema de archivos efímero**, lo que significa que:
- Los archivos subidos se **pierden** cuando el servicio se reinicia
- Los archivos subidos se **pierden** cuando se despliega una nueva versión
- **NO se pueden guardar archivos** directamente en el servidor

## ✅ Soluciones Recomendadas

### Opción 1: Cloudinary (Recomendado - Gratis hasta 25GB)

**Ventajas:**
- ✅ Gratis hasta 25GB de almacenamiento
- ✅ CDN incluido (archivos se cargan rápido)
- ✅ Optimización automática de imágenes
- ✅ Fácil de integrar
- ✅ Soporta PDFs, imágenes, documentos

**Pasos:**

1. **Crear cuenta en Cloudinary:**
   - Ve a https://cloudinary.com
   - Crea una cuenta gratuita
   - Obtén tus credenciales: `cloud_name`, `api_key`, `api_secret`

2. **Instalar dependencias:**
   ```bash
   cd gestion_riesgos_backend
   npm install cloudinary multer
   npm install --save-dev @types/multer
   ```

3. **Configurar variables de entorno en Render:**
   ```
   CLOUDINARY_CLOUD_NAME=tu_cloud_name
   CLOUDINARY_API_KEY=tu_api_key
   CLOUDINARY_API_SECRET=tu_api_secret
   ```

4. **Usar el código de ejemplo** (ver `src/utils/cloudinary.ts` y `src/routes/upload.routes.ts`)

---

### Opción 2: AWS S3 (Más robusto, pero requiere configuración)

**Ventajas:**
- ✅ Muy escalable
- ✅ Muy confiable
- ✅ Gratis hasta 5GB (tier gratuito)

**Desventajas:**
- ⚠️ Requiere cuenta de AWS
- ⚠️ Configuración más compleja

---

### Opción 3: Base64 en Base de Datos (Solo para archivos pequeños < 1MB)

**Ventajas:**
- ✅ No requiere servicios externos
- ✅ Simple de implementar

**Desventajas:**
- ⚠️ Solo para archivos pequeños
- ⚠️ Aumenta el tamaño de la base de datos
- ⚠️ No recomendado para producción

---

## 🚀 Implementación Recomendada: Cloudinary

### Paso 1: Instalar dependencias

```bash
cd gestion_riesgos_backend
npm install cloudinary multer
npm install --save-dev @types/multer
```

### Paso 2: Configurar Cloudinary

Crea `src/utils/cloudinary.ts`:

```typescript
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;
```

### Paso 3: Crear ruta de subida

Crea `src/routes/upload.routes.ts`:

```typescript
import express from 'express';
import multer from 'multer';
import cloudinary from '../utils/cloudinary';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

router.post('/archivo', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    // Subir a Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'auto', // Detecta automáticamente el tipo
          folder: 'gestion-riesgos', // Carpeta en Cloudinary
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    res.json({
      url: (result as any).secure_url,
      publicId: (result as any).public_id,
      nombre: req.file.originalname,
      tamaño: req.file.size,
      formato: req.file.mimetype,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Error al subir el archivo' });
  }
});

router.delete('/archivo/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    await cloudinary.uploader.destroy(publicId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Error al eliminar el archivo' });
  }
});

export default router;
```

### Paso 4: Agregar ruta al router principal

En `src/routes/index.ts`:

```typescript
import uploadRoutes from './upload.routes';
// ...
app.use('/api/upload', uploadRoutes);
```

### Paso 5: Actualizar frontend

En `gestion-riesgos-app/src/pages/procesos/AnalisisProcesoPage.tsx`:

```typescript
const handleSave = async () => {
  try {
    let documentoUrl = savedFile?.url || null;
    let documentoNombre = savedFile?.name || null;

    // Si hay un archivo nuevo, subirlo primero
    if (selectedFile) {
      const formData = new FormData();
      formData.append('archivo', selectedFile);

      const uploadResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/upload/archivo`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Error al subir el archivo');
      }

      const uploadData = await uploadResponse.json();
      documentoUrl = uploadData.url;
      documentoNombre = uploadData.nombre;
    }

    // Guardar proceso con URL del archivo
    await updateProceso({
      id: procesoSeleccionado.id,
      analisis: descripcion,
      documentoUrl,
      documentoNombre,
    }).unwrap();

    setSelectedFile(null);
    showSuccess('Análisis de proceso y documentación guardados exitosamente');
  } catch (error) {
    showError('Error al guardar el análisis');
  }
};
```

---

## 📝 Variables de Entorno Necesarias

### En Render (Dashboard → Environment):

```
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

### En Local (.env):

```
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

---

## 🔒 Seguridad

1. **Nunca expongas** `CLOUDINARY_API_SECRET` en el frontend
2. **Valida** el tipo y tamaño de archivo en el backend
3. **Usa HTTPS** siempre (Cloudinary lo proporciona automáticamente)
4. **Limita** el tamaño de archivo (ej: 5MB máximo)

---

## 📊 Alternativa: Base64 (Solo para archivos pequeños)

Si prefieres no usar servicios externos y los archivos son pequeños (< 1MB):

```typescript
// En el frontend, convertir a base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// Guardar en la base de datos como string
await updateProceso({
  documentoUrl: await fileToBase64(selectedFile),
  documentoNombre: selectedFile.name,
});
```

**⚠️ Nota:** Esto solo funciona para archivos pequeños y aumenta el tamaño de la base de datos.

---

## 🎯 Recomendación Final

**Usa Cloudinary** porque:
- ✅ Es gratis hasta 25GB
- ✅ Fácil de configurar
- ✅ CDN incluido
- ✅ Funciona perfectamente con Render
- ✅ No se pierden archivos al reiniciar

