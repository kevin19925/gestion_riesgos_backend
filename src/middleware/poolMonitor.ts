import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para monitorear el estado del pool de conexiones
 * 
 * Agrega headers de respuesta con información del pool para debugging
 * Solo se activa en modo desarrollo
 */
export function poolMonitorMiddleware(req: Request, res: Response, next: NextFunction) {
    // Solo en desarrollo
    if (process.env.NODE_ENV === 'production') {
        return next();
    }

    // Capturar el tiempo de inicio
    const startTime = Date.now();

    // Interceptar el método res.json para agregar headers antes de enviar
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
        const duration = Date.now() - startTime;
        
        // Agregar headers de monitoreo
        res.setHeader('X-Response-Time', `${duration}ms`);
        res.setHeader('X-Pool-Monitor', 'enabled');
        
        // Si la respuesta tardó más de 2 segundos, loguear advertencia
        if (duration > 2000) {
            console.warn(`⚠️ Respuesta lenta en ${req.method} ${req.path}: ${duration}ms`);
        }
        
        return originalJson(body);
    };

    next();
}

/**
 * Endpoint para verificar el estado del sistema
 * Útil para health checks y monitoreo
 */
export async function healthCheck(req: Request, res: Response) {
    try {
        const health = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                unit: 'MB'
            },
            environment: process.env.NODE_ENV || 'development',
        };

        res.json(health);
    } catch (error) {
        res.status(503).json({
            status: 'error',
            message: 'Service unavailable',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
