/**
 * Azure Blob Storage - Subida y eliminación de archivos
 * En la base de datos solo se guarda la URL (dirección) del archivo.
 */

import {
  BlobServiceClient,
  ContainerClient,
  BlockBlobClient,
} from '@azure/storage-blob';
const CONTAINER_DEFAULT = 'archivos';
const CONTAINER_IMG_PERFILES_DEFAULT = 'img-perfiles';

let blobServiceClient: BlobServiceClient | null = null;
let containerName: string = CONTAINER_DEFAULT;

function getConnectionString(): string {
  const raw = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!raw || !raw.trim()) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING no está configurada.');
  }
  return raw
    .replace(/^\uFEFF/, '')
    .replace(/^["']|["']$/g, '')
    .replace(/\r\n?/g, '')
    .trim();
}

function sanitizeContainerName(raw: string): string {
  const s = (typeof raw === 'string' ? raw : String(raw))
    .replace(/^\uFEFF/, '')
    .replace(/^["']|["']$/g, '')
    .replace(/\r\n?/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (s.length < 3) return CONTAINER_DEFAULT;
  return s.slice(0, 63);
}

function getBlobServiceClient(): BlobServiceClient {
  if (!blobServiceClient) {
    blobServiceClient = BlobServiceClient.fromConnectionString(getConnectionString());
  }
  return blobServiceClient;
}

function getContainer(): ContainerClient {
  const raw = process.env.AZURE_STORAGE_CONTAINER || CONTAINER_DEFAULT;
  containerName = sanitizeContainerName(raw);
  return getBlobServiceClient().getContainerClient(containerName);
}

function getContainerPerfiles(): ContainerClient {
  let raw = process.env.AZURE_STORAGE_CONTAINER_IMG_PERFILES || CONTAINER_IMG_PERFILES_DEFAULT;
  raw = (raw ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/^["']|["']$/g, '')
    .trim();
  const name = sanitizeContainerName(raw) || CONTAINER_IMG_PERFILES_DEFAULT;
  return getBlobServiceClient().getContainerClient(name);
}

/**
 * Nombre de blob igual que en prueba-subida-azure (timestamp + nombre seguro, sin rutas).
 */
function uniqueBlobName(originalName: string): string {
  const safe = (originalName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  return `${Date.now()}-${safe}`;
}

/**
 * Nombre de blob para foto de perfil: basado en el nombre del usuario (y userId para unicidad).
 * Ej: "Vinicio Barahona" + userId 117 -> "117-vinicio-barahona.jpg"
 */
function blobNamePerfil(nombrePerfil: string, userId: number | string, extension: string): string {
  const slug = (nombrePerfil || 'perfil')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'perfil';
  const ext = extension.startsWith('.') ? extension.slice(0, 6) : `.${extension.slice(0, 5)}`;
  // Se agrega versión temporal para evitar que navegadores/CDN sirvan foto antigua por caché.
  return `${userId}-${slug}-${Date.now()}${ext}`;
}

function extensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
  };
  return map[mime?.toLowerCase()] || '.jpg';
}

/**
 * Sube un buffer a Azure Blob Storage y devuelve la URL.
 * Misma lógica que prueba-subida-azure/server.js (solo blobContentType, sin Content-Disposition).
 */
export async function uploadToBlob(
  buffer: Buffer,
  originalName: string,
  contentType: string
): Promise<{ url: string; blobName: string }> {
  const container = getContainer();
  await container.createIfNotExists();
  const blobName = uniqueBlobName(originalName);
  const blockBlob: BlockBlobClient = container.getBlockBlobClient(blobName);

  await blockBlob.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: contentType || 'application/octet-stream',
    },
  });

  const url = blockBlob.url;
  return { url, blobName };
}

/**
 * Sube una imagen de perfil al contenedor de perfiles (img-perfiles).
 * El blob se nombra con el nombre del usuario: userId-nombre-slug.ext
 */
export async function uploadToBlobPerfil(
  buffer: Buffer,
  nombrePerfil: string,
  userId: number | string,
  contentType: string
): Promise<{ url: string; blobName: string }> {
  const container = getContainerPerfiles();
  await container.createIfNotExists();
  const ext = extensionFromMime(contentType);
  const blobName = blobNamePerfil(nombrePerfil, userId, ext);
  const blockBlob = container.getBlockBlobClient(blobName);

  await blockBlob.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: contentType || 'image/jpeg',
    },
  });

  return { url: blockBlob.url, blobName };
}

/**
 * Parsea la URL de un blob para obtener nombre del contenedor y del blob.
 * URL formato: https://cuenta.blob.core.windows.net/contenedor/ruta/al/blob.pdf
 */
function parseBlobUrl(blobUrl: string): { accountUrl: string; containerName: string; blobName: string } | null {
  try {
    const u = new URL(blobUrl);
    const pathParts = u.pathname.replace(/^\/+/, '').split('/');
    if (pathParts.length < 2) return null;
    const [container, ...blobParts] = pathParts;
    const blobName = blobParts.join('/');
    const accountUrl = `${u.protocol}//${u.hostname}`;
    return { accountUrl, containerName: container, blobName };
  } catch {
    return null;
  }
}

/**
 * Elimina un archivo en Azure Blob a partir de su URL (la misma que guardaste en la BD).
 */
export async function deleteBlobByUrl(blobUrl: string): Promise<boolean> {
  const parsed = parseBlobUrl(blobUrl);
  if (!parsed) {
    // URL no válida para eliminar
    return false;
  }

  const client = getBlobServiceClient();
  const container = client.getContainerClient(parsed.containerName);
  const blockBlob = container.getBlockBlobClient(parsed.blobName);
  const result = await blockBlob.deleteIfExists();
  return result.succeeded;
}

export function isAzureBlobConfigured(): boolean {
  const raw = process.env.AZURE_STORAGE_CONNECTION_STRING;
  return !!(raw && raw.trim());
}
