/**
 * Upload Routes
 * Manejo de subida de archivos usando Cloudinary
 * Compatible con Render (sistema de archivos efímero)
 */

import express from 'express';
import multer from 'multer';
import cloudinary from '../utils/cloudinary';

const router = express.Router();

// Configurar multer para almacenar en memoria (no en disco, porque Render es efímero)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  },
  fileFilter: (req, file, cb) => {
    // Permitir PDFs, imágenes y documentos comunes
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/msword', // .doc
      'application/vnd.ms-excel', // .xls
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo se permiten PDFs, imágenes y documentos de Office.'));
    }
  }
});

/**
 * POST /api/upload/archivo
 * Sube un archivo a Cloudinary
 */
router.post('/archivo', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    // Verificar que Cloudinary esté configurado
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({ 
        error: 'Cloudinary no está configurado. Contacte al administrador.' 
      });
    }

    console.log(`[UPLOAD] Subiendo archivo: ${req.file.originalname} (${req.file.size} bytes)`);

    // Subir a Cloudinary
    const result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'auto', // Detecta automáticamente el tipo (image, video, raw)
          folder: 'gestion-riesgos', // Carpeta en Cloudinary
          allowed_formats: ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'doc', 'docx', 'xls', 'xlsx'],
        },
        (error, result) => {
          if (error) {
            console.error('[UPLOAD] Error en Cloudinary:', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      
      uploadStream.end(req.file.buffer);
    });

    console.log(`[UPLOAD] ✅ Archivo subido exitosamente: ${result.secure_url}`);

    res.json({
      url: result.secure_url,
      publicId: result.public_id,
      nombre: req.file.originalname,
      tamaño: req.file.size,
      formato: req.file.mimetype,
      width: result.width,
      height: result.height,
    });
  } catch (error: any) {
    console.error('[UPLOAD] ❌ Error al subir archivo:', error);
    res.status(500).json({ 
      error: error.message || 'Error al subir el archivo' 
    });
  }
});

/**
 * DELETE /api/upload/archivo/:publicId
 * Elimina un archivo de Cloudinary
 */
router.delete('/archivo/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({ 
        error: 'Cloudinary no está configurado. Contacte al administrador.' 
      });
    }

    console.log(`[UPLOAD] Eliminando archivo: ${publicId}`);

    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result === 'ok') {
      console.log(`[UPLOAD] ✅ Archivo eliminado: ${publicId}`);
      res.json({ success: true, message: 'Archivo eliminado exitosamente' });
    } else {
      console.warn(`[UPLOAD] ⚠️ No se pudo eliminar el archivo: ${publicId}`);
      res.status(404).json({ error: 'Archivo no encontrado' });
    }
  } catch (error: any) {
    console.error('[UPLOAD] ❌ Error al eliminar archivo:', error);
    res.status(500).json({ 
      error: error.message || 'Error al eliminar el archivo' 
    });
  }
});

export default router;

