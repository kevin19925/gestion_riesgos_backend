# 🚀 Pasos Rápidos para Configurar Archivos en Render

## 1️⃣ Crear cuenta en Cloudinary (5 minutos)

1. Ve a https://cloudinary.com/users/register/free
2. Crea una cuenta gratuita
3. En el Dashboard, ve a "Settings" → "Security"
4. Copia estos valores:
   - **Cloud Name** (ej: `dflores`)
   - **API Key** (ej: `123456789012345`)
   - **API Secret** (ej: `abcdefghijklmnopqrstuvwxyz`)

## 2️⃣ Configurar variables de entorno

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

## 3️⃣ Instalar dependencias

```bash
cd gestion_riesgos_backend
npm install cloudinary multer
npm install --save-dev @types/multer
```

## 4️⃣ Reiniciar el servidor

```bash
npm run dev
```

## 5️⃣ Probar la subida

```bash
# Desde Postman o curl
curl -X POST http://localhost:8080/api/upload/archivo \
  -F "archivo=@/ruta/a/tu/archivo.pdf"
```

Deberías recibir una respuesta con la URL del archivo en Cloudinary.

## ✅ Listo!

Ahora puedes usar el endpoint `/api/upload/archivo` desde el frontend para subir archivos.

---

## 📝 Actualizar Frontend

En `AnalisisProcesoPage.tsx`, reemplaza el `handleSave` con:

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

## ⚠️ Importante

- Los archivos se guardan en Cloudinary, **NO en el servidor de Render**
- Los archivos **NO se pierden** al reiniciar el servidor
- Límite de tamaño: **5MB por archivo**
- Tipos permitidos: PDF, imágenes (JPG, PNG, GIF), documentos Office (DOC, DOCX, XLS, XLSX)

