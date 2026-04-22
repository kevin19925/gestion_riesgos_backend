import { Request, Response } from 'express';
import {
  getStrategicEngineConfigResolved,
  persistStrategicEngineConfig,
  getDefaultStrategicEngineConfigForApi,
} from '../services/estrategicoResidualConfig.service';
import { recalcularTodosRiesgosEstrategicos } from '../services/estrategicoResidual.service';

export async function getConfiguracionResidualEstrategica(_req: Request, res: Response) {
  try {
    const config = await getStrategicEngineConfigResolved();
    res.json({
      config,
      defaults: getDefaultStrategicEngineConfigForApi(),
    });
  } catch (e: any) {
    console.error('[configuracion-residual-estrategica/GET]', e?.message ?? e);
    res.status(500).json({
      error: 'Error al leer la parametrización',
      ...(process.env.NODE_ENV !== 'production' && { details: e?.message }),
    });
  }
}

export async function putConfiguracionResidualEstrategica(req: Request, res: Response) {
  try {
    const body = req.body?.config ?? req.body;
    const config = await persistStrategicEngineConfig(body);
    const resultadoRecalc = await recalcularTodosRiesgosEstrategicos();
    const { procesados, errores } = resultadoRecalc;
    if (errores.length) {
      console.warn(
        `[configuracion-residual-estrategica/PUT] Recálculo con ${errores.length} advertencia(s); procesados=${procesados}`
      );
    } else {
      console.log(`[configuracion-residual-estrategica/PUT] Recálculo estratégico: ${procesados} riesgo(s).`);
    }
    res.json({
      success: true,
      message:
        'Parametrización guardada y residuales de procesos estratégicos recalculados con la nueva configuración.',
      config,
      defaults: getDefaultStrategicEngineConfigForApi(),
      recalc: { procesados, errores },
    });
  } catch (e: any) {
    console.error('[configuracion-residual-estrategica/PUT]', e?.message ?? e);
    res.status(500).json({
      error: 'Error al guardar la parametrización',
      ...(process.env.NODE_ENV !== 'production' && { details: e?.message }),
    });
  }
}

export async function postRecalcularResidualEstrategico(_req: Request, res: Response) {
  try {
    const result = await recalcularTodosRiesgosEstrategicos();
    res.json(result);
  } catch (e: any) {
    console.error('[configuracion-residual-estrategica/recalcular]', e?.message ?? e);
    res.status(500).json({
      error: 'Error al recalcular residuales estratégicos',
      ...(process.env.NODE_ENV !== 'production' && { details: e?.message }),
    });
  }
}
