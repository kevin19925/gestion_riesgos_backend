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

      client.on('error', () => {
        isReady = false;
      });

      client.on('ready', () => {
        isReady = true;
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
    // ignore
  }
}

export async function redisDel(key: string): Promise<void> {
  try {
    const c = await getRedisClient();
    if (!c) return;
    await c.del(key);
  } catch (err) {
    // ignore
  }
}

