import { Router } from 'express';
import {
    getListasValores, getTipologias, getConfiguraciones, getObjetivos, getFormulas, getMapaConfig,
    getFrecuencias, getFuentes, getOrigenes, getTiposProceso, getConsecuencias, getNivelesRiesgo, getImpactos, getEjesMapa,
    updateConfiguracion, updateMapaConfig
} from '../controllers/catalogos.controller';

const router = Router();

router.get('/listas-valores', getListasValores);
router.get('/tipologias', getTipologias);
router.get('/configuraciones', getConfiguraciones);
router.get('/mapa-config', getMapaConfig);
router.get('/objetivos', getObjetivos);
router.get('/formulas', getFormulas);
router.get('/frecuencias', getFrecuencias);
router.get('/fuentes', getFuentes);
router.get('/origenes', getOrigenes);
router.get('/tipos-proceso', getTiposProceso);
router.get('/consecuencias', getConsecuencias);
router.get('/niveles-riesgo', getNivelesRiesgo);
router.get('/impactos', getImpactos);
router.get('/ejes-mapa', getEjesMapa);

router.put('/configuraciones/:id', updateConfiguracion);
router.put('/mapa-config', updateMapaConfig);

export default router;
