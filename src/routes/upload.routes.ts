/**
 * Upload Routes
 * Subida y eliminación de archivos usando Azure Blob Storage.
 * En la base de datos se guarda solo la URL del archivo.
 */

import express, { Request, Response } from 'express';
import multer from 'multer';
import { uploadToBlob, uploadToBlobPerfil, deleteBlobByUrl, isAzureBlobConfigured } from '../utils/azureBlob';
import prisma from '../prisma';

const router = express.Router();

interface RequestWithFile extends Request {
  file?: Express.Multer.File;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB (evidencias y adjuntos generales)
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo PDFs, imágenes y documentos de Office.'));
    }
  },
});

/**
 * POST /api/upload/archivo
 * Sube un archivo a Azure Blob Storage. Devuelve la URL para guardar en BD.
 */
const uploadMiddleware = upload.single('archivo') as any;
router.post('/archivo', uploadMiddleware, async (req: RequestWithFile, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }
    if (!isAzureBlobConfigured()) {
      return res.status(500).json({
        error: 'Azure Blob Storage no está configurado. Contacte al administrador.',
      });
    }

    const { url, blobName } = await uploadToBlob(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype || 'application/octet-stream'
    );

    res.json({
      url,
      nombre: req.file.originalname,
      tamaño: req.file.size,
      formato: req.file.mimetype,
      blobName,
    });
  } catch (error: any) {
    const message = error.message || 'Error al subir el archivo';
    console.error('[upload/archivo]', message, error?.stack || '');
    res.status(500).json({
      error: message,
    });
  }
});

const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const uploadPerfil = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB para fotos de perfil
  fileFilter: (_req, file, cb) => {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (JPEG, PNG, GIF, WebP).'));
    }
  },
});

/**
 * POST /api/upload/perfil
 * Sube la foto de perfil del usuario al contenedor img-perfiles.
 * Requiere token. El archivo se renombra con el nombre del perfil (ej. 117-vinicio-barahona.jpg).
 */
router.post('/perfil', uploadPerfil.single('archivo'), async (req: RequestWithFile, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
    }
    if (!isAzureBlobConfigured()) {
      return res.status(500).json({
        error: 'Azure Blob Storage no está configurado. Contacte al administrador.',
      });
    }

    const user = await prisma.usuario.findUnique({
      where: { id: Number(userId) },
      select: { nombre: true },
    });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { url, blobName } = await uploadToBlobPerfil(
      req.file.buffer,
      user.nombre,
      userId,
      req.file.mimetype || 'image/jpeg'
    );

    res.json({
      url,
      nombre: req.file.originalname,
      blobName,
    });
  } catch (error: any) {
    const message = error.message || 'Error al subir la foto de perfil';
    console.error('[upload/perfil]', message, error?.stack || '');
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/upload/archivo/by-url?url=...
 * Elimina un archivo en Azure Blob por su URL (la guardada en BD).
 */
router.delete('/archivo/by-url', async (req, res) => {
  try {
    const url = typeof req.query.url === 'string' ? req.query.url : '';
    if (!url) {
      return res.status(400).json({ error: 'Falta el parámetro url' });
    }
    if (!isAzureBlobConfigured()) {
      return res.status(500).json({
        error: 'Azure Blob Storage no está configurado. Contacte al administrador.',
      });
    }

    const deleted = await deleteBlobByUrl(url);
    if (deleted) {
      res.json({ success: true, message: 'Archivo eliminado exitosamente' });
    } else {
      res.status(404).json({ error: 'Archivo no encontrado o no se pudo eliminar' });
    }
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Error al eliminar el archivo',
    });
  }
});

/**
 * DELETE /api/upload/archivo/:publicId
 * Compatibilidad con clientes que envían publicId (Cloudinary). Con Azure se ignora; usar by-url.
 */
router.delete('/archivo/:publicId', async (req, res) => {
  res.status(400).json({
    error: 'Use DELETE /api/upload/archivo/by-url?url=... para eliminar por URL (Azure Blob).',
  });
});

export default router;
