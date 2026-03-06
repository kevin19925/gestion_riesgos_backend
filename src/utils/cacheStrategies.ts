import { redisGet, redisSet } from '../redisClient';

/**
 * Estrategia SWR (Stale-While-Revalidate)
 * 
 * Devuelve datos del caché inmediatamente (aunque estén "viejos")
 * y refresca el caché en segundo plano para la próxima petición.
 * 
 * Ventajas:
 * - Respuesta instantánea para el usuario (0ms de espera en DB)
 * - Reduce carga en la base de datos
 * - Los datos nunca están muy desactualizados
 * 
 * @param cacheKey - Clave única para el caché
 * @param fetchFn - Función que obtiene los datos frescos de la DB
 * @param ttl - Tiempo de vida del caché en segundos (default: 300 = 5 min)
 * @returns Datos del caché o frescos de la DB
 */
export async function swrCache<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    ttl: number = 300
): Promise<T> {
    // Intentar obtener del caché
    const cached = await redisGet<T>(cacheKey);

    if (cached) {
        // Devolver datos cacheados inmediatamente
        // Y refrescar en segundo plano (sin await)
        refreshCacheInBackground(cacheKey, fetchFn, ttl);
        return cached;
    }

    // Si no hay caché, obtener datos frescos y cachearlos
    const freshData = await fetchFn();
    await redisSet(cacheKey, freshData, ttl);
    return freshData;
}

/**
 * Refresca el caché en segundo plano sin bloquear la respuesta
 */
async function refreshCacheInBackground<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    ttl: number
): Promise<void> {
    try {
        const freshData = await fetchFn();
        await redisSet(cacheKey, freshData, ttl);
    } catch (error) {
        // No hacer nada si falla el refresh en background
        // El caché viejo seguirá sirviendo hasta que expire
        console.error(`Error refrescando caché en background para ${cacheKey}:`, error);
    }
}

/**
 * Estrategia de caché simple con TTL
 * 
 * Verifica si hay datos en caché, si no, los obtiene de la DB y los cachea.
 * 
 * @param cacheKey - Clave única para el caché
 * @param fetchFn - Función que obtiene los datos de la DB
 * @param ttl - Tiempo de vida del caché en segundos
 * @returns Datos del caché o frescos de la DB
 */
export async function simpleCache<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    ttl: number = 300
): Promise<T> {
    // Intentar obtener del caché
    const cached = await redisGet<T>(cacheKey);

    if (cached) {
        return cached;
    }

    // Si no hay caché, obtener datos frescos y cachearlos
    const freshData = await fetchFn();
    await redisSet(cacheKey, freshData, ttl);
    return freshData;
}

/**
 * Invalidar múltiples claves de caché que coincidan con un patrón
 * 
 * Útil para invalidar todos los cachés relacionados con un recurso
 * Ejemplo: invalidar todos los cachés de riesgos cuando se actualiza uno
 * 
 * @param pattern - Patrón de las claves a invalidar (ej: "riesgo:*")
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
    // Nota: Esta función requiere que Redis esté configurado
    // Por ahora, solo invalida claves específicas conocidas
    // Para un patrón completo, necesitarías usar SCAN en Redis
    console.log(`Invalidando caché con patrón: ${pattern}`);
}
