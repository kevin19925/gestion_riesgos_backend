import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

// Configuración del Pool con límites y timeouts
const url = (process.env.DATABASE_URL || '').replace(/^"|"$/g, '');
const pool = new Pool({
    connectionString: url,
    max: 20,                          // Límite de 20 conexiones simultáneas
    idleTimeoutMillis: 30000,         // 30s para cerrar conexiones inactivas
    connectionTimeoutMillis: 2000,    // 2s para fallar si no hay conexión disponible
    ssl: {
        rejectUnauthorized: false     // Obligatorio para Azure
    }
});

// Logs del pool para monitoreo
pool.on('connect', () => {
    console.log('✅ Prisma conectó un nuevo cliente al Pool');
});

pool.on('error', (err) => {
    console.error('❌ Error en el Pool de Postgres:', err);
});

pool.on('remove', () => {
    console.log('🔌 Cliente removido del Pool');
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

// Query logging para detectar consultas lentas (> 1 segundo)
prisma.$on('query' as never, (e: any) => {
    if (e.duration > 1000) {
        console.warn(`⚠️ CONSULTA LENTA DETECTADA:`);
        console.warn(`   Query: ${e.query}`);
        console.warn(`   Duración: ${e.duration}ms`);
        console.warn(`   Params: ${e.params}`);
    }
});

// En desarrollo, guardar la instancia en global para reutilizarla
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

// Graceful shutdown: cerrar conexiones al terminar el proceso
process.on('beforeExit', async () => {
    console.log('🔄 Cerrando conexiones de Prisma...');
    await prisma.$disconnect();
    await pool.end();
    console.log('✅ Conexiones cerradas correctamente');
});

export default prisma;
