import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

// Configuración del Pool con límites y timeouts
const url = (process.env.DATABASE_URL || '').replace(/^"|"$/g, '');
const pool = new Pool({
    connectionString: url,
    max: 20,                          // Reducido a 20 para evitar saturación
    min: 2,                           // Mantener 2 conexiones mínimas activas
    idleTimeoutMillis: 30000,         // 30s para cerrar conexiones inactivas
    connectionTimeoutMillis: 30000,   // Aumentado a 30s para Azure (alta latencia)
    statement_timeout: 60000,         // 60s timeout para queries
    query_timeout: 60000,             // 60s timeout para queries
    keepAlive: true,                  // Mantener conexiones vivas
    keepAliveInitialDelayMillis: 10000, // Delay inicial para keep-alive
    ssl: {
        rejectUnauthorized: false     // Obligatorio para Azure
    }
});

// Logs del pool para monitoreo: solo errores
pool.on('error', (err) => {
    console.error('[POOL] Error en conexión Postgres:', err);
});

// Adaptador de Prisma con el pool configurado
const adapter = new PrismaPg(pool);

// Patrón Singleton para evitar múltiples instancias en desarrollo (nodemon)
const globalForPrisma = global as unknown as { prisma: PrismaClient };

const prisma = globalForPrisma.prisma || new PrismaClient({ 
    adapter,
    log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
    ],
});

// Query logging: solo consultas lentas (>500ms)
const SLOW_QUERY_MS = 500;
prisma.$on('query' as never, (e: any) => {
    if (e.duration > SLOW_QUERY_MS) {
        console.warn(`[SLOW QUERY] ${e.duration}ms |`, e.query?.substring?.(0, 120));
    }
});

// En desarrollo, guardar la instancia en global para reutilizarla
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
    await prisma.$disconnect();
    await pool.end();
});

export default prisma;
