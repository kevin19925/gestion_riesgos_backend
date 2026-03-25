import app from './app';
import dotenv from 'dotenv';
import http from 'http';
import { iniciarCronJobs, detenerCronJobs } from './services/cron.service';
import { ensureSchema } from './db/ensureSchema';

dotenv.config();

const port = process.env.PORT || 8080;

const server = http.createServer(app);

server.listen(port, async () => {
    console.log(`[SERVER] Servidor iniciado en puerto ${port}`);

    try {
        await ensureSchema();
        console.log('[DB] Esquema verificado (migración idempotente aplicada si hacía falta).');
    } catch (e: any) {
        console.error('[DB] No se pudo verificar/aplicar esquema:', e?.message ?? e);
    }

    // Iniciar cron jobs
    iniciarCronJobs();
});

process.on('SIGTERM', () => {
    console.log('[SERVER] Señal SIGTERM recibida, cerrando servidor...');
    
    // Detener cron jobs
    detenerCronJobs();
    
    server.close(() => {
        console.log('[SERVER] Servidor cerrado correctamente');
    });
});
