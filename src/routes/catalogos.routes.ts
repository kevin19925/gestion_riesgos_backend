import { Router } from 'express';
import {
    getListasValores, getTipologias, createTipologia, updateTipologia, deleteTipologia,
    getConfiguraciones, createConfiguracion, getObjetivos, createObjetivo, updateObjetivo, deleteObjetivo,
    getFormulas, getMapaConfig,
    getFrecuencias, getFuentes, getOrigenes, getTiposProceso, getConsecuencias, getNivelesRiesgo, getImpactos, getEjesMapa,
    getVicepresidencias, updateConfiguracion, updateMapaConfig,
    getPesosImpacto, updatePesosImpacto,
    updateFrecuencias, updateFuentes, updateOrigenes, updateConsecuencias,
    createImpactoTipo, updateImpactoNiveles, deleteImpactoTipo,
    getSubtipos, createSubtipo, updateSubtipo, deleteSubtipo
} from '../controllers/catalogos.controller';

const router = Router();

router.get('/listas-valores', getListasValores);
router.get('/tipologias', getTipologias);
router.post('/tipologias', createTipologia);
router.put('/tipologias/:id', updateTipologia);
router.delete('/tipologias/:id', deleteTipologia);
router.get('/subtipos', getSubtipos);
router.post('/subtipos', createSubtipo);
router.put('/subtipos/:id', updateSubtipo);
router.delete('/subtipos/:id', deleteSubtipo);

router.get('/configuraciones', getConfiguraciones);
router.post('/configuraciones', createConfiguracion);
router.get('/mapa-config', getMapaConfig);

router.get('/objetivos', getObjetivos);
router.post('/objetivos', createObjetivo);
router.put('/objetivos/:id', updateObjetivo);
router.delete('/objetivos/:id', deleteObjetivo);

router.get('/formulas', getFormulas);
router.get('/frecuencias', getFrecuencias);
router.get('/fuentes', getFuentes);
router.get('/origenes', getOrigenes);
router.get('/tipos-proceso', getTiposProceso);
router.get('/consecuencias', getConsecuencias);
router.get('/niveles-riesgo', getNivelesRiesgo);
router.get('/impactos', getImpactos);
router.get('/ejes-mapa', getEjesMapa);
router.get('/vicepresidencias', getVicepresidencias);

router.put('/frecuencias', updateFrecuencias);
router.put('/fuentes', updateFuentes);
router.put('/origenes', updateOrigenes);
router.put('/consecuencias', updateConsecuencias);

router.post('/impactos', createImpactoTipo);
router.put('/impactos/:id', updateImpactoNiveles);
router.delete('/impactos/:id', deleteImpactoTipo);

router.put('/configuraciones/:id', updateConfiguracion);
router.put('/mapa-config', updateMapaConfig);

router.get('/pesos-impacto', getPesosImpacto);
router.put('/pesos-impacto', updatePesosImpacto);

export default router;
