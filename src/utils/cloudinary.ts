/**
 * Cloudinary Configuration
 * Para manejo de archivos en Render (sistema de archivos efímero)
 */

import { v2 as cloudinary } from 'cloudinary';

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn('[CLOUDINARY] ⚠️ Variables de entorno de Cloudinary no configuradas. La subida de archivos no funcionará.');
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('[CLOUDINARY] ✅ Configurado correctamente');
}

export default cloudinary;

