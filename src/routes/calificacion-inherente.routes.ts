import { Router } from 'express';
import {
  getConfigActiva,
  getAllConfigs,
  getConfigById,
  createConfig,
  updateConfig,
  deleteConfig,
  calcularCalificacionInherente
} from '../controllers/calificacion-inherente.controller';

const router = Router();

// Obtener configuración activa
router.get('/activa', getConfigActiva);

// Obtener todas las configuraciones
router.get('/', getAllConfigs);

// Obtener configuración por ID
router.get('/:id', getConfigById);

// Crear nueva configuración
router.post('/', createConfig);

// Actualizar configuración
router.put('/:id', updateConfig);

// Eliminar configuración
router.delete('/:id', deleteConfig);

// Calcular calificación inherente (utilidad para testing)
router.post('/calcular', calcularCalificacionInherente);

export default router;

