import { createClient, RedisClientType } from 'redis';

let client: RedisClientType | null = null;
let isReady = false;

const redisUrl =
  process.env.REDIS_URL ||
  process.env.UPSTASH_REDIS_REST_URL || // Upstash (si se usa)
  process.env.UPSTASH_REDIS_URL || // compatibilidad
  '';

export async function getRedisClient(): Promise<RedisClientType | null> {
  try {
    if (!redisUrl) {
      return null;
    }

    if (!client) {
      client = createClient({ url: redisUrl });

      client.on('error', (err) => {
        isReady = false;
        console.error('[REDIS] Error en cliente Redis:', err);
      });

      client.on('ready', () => {
        isReady = true;
        console.log('[REDIS] Cliente listo');
      });

      // Conectar una sola vez
      await client.connect();
      isReady = true;
    }

    if (!isReady) {
      return null;
    }

    return client;
  } catch (err) {
    console.error('[REDIS] Error inicializando cliente:', err);
    return null;
  }
}

export async function redisGet<T = any>(key: string): Promise<T | null> {
  try {
    const c = await getRedisClient();
    if (!c) return null;
    const raw = (await c.get(key)) as string | null;
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error('[REDIS] Error en GET', key, err);
    return null;
  }
}

export async function redisSet(
  key: string,
  value: any,
  ttlSeconds: number
): Promise<void> {
  try {
    const c = await getRedisClient();
    if (!c) return;
    const payload = JSON.stringify(value);
    await c.set(key, payload, { EX: ttlSeconds });
  } catch (err) {
    console.error('[REDIS] Error en SET', key, err);
  }
}

