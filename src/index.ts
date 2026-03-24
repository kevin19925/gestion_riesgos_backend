import app from './app';
import dotenv from 'dotenv';
import http from 'http';
import { iniciarCronJobs, detenerCronJobs } from './services/cron.service';

dotenv.config();

const port = process.env.PORT || 8080;

const server = http.createServer(app);

server.listen(port, () => {
    console.log(`[SERVER] Servidor iniciado en puerto ${port}`);
    
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
