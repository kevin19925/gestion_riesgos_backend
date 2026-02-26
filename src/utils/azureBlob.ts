/**
 * Azure Blob Storage - Subida y eliminación de archivos
 * En la base de datos solo se guarda la URL (dirección) del archivo.
 */

import {
  BlobServiceClient,
  ContainerClient,
  BlockBlobClient,
} from '@azure/storage-blob';
import { randomUUID } from 'crypto';

const CONTAINER_DEFAULT = 'archivos';

let blobServiceClient: BlobServiceClient | null = null;
let containerName: string = CONTAINER_DEFAULT;

function getBlobServiceClient(): BlobServiceClient {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING no está configurada.');
  }
  if (!blobServiceClient) {
    blobServiceClient = BlobServiceClient.fromConnectionString(conn);
  }
  return blobServiceClient;
}

function getContainer(): ContainerClient {
  const name = process.env.AZURE_STORAGE_CONTAINER || CONTAINER_DEFAULT;
  containerName = name;
  return getBlobServiceClient().getContainerClient(name);
}

/**
 * Genera un nombre único para el blob: archivos/año/mes/día/uuid-nombreOriginal
 */
function uniqueBlobName(originalName: string): string {
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}/${randomUUID()}-${safe}`;
}

/**
 * Sube un buffer a Azure Blob Storage y devuelve la URL.
 * Esa URL es la única cosa que debes guardar en la base de datos.
 */
export async function uploadToBlob(
  buffer: Buffer,
  originalName: string,
  contentType: string
): Promise<{ url: string; blobName: string }> {
  const container = getContainer();
  await container.createIfNotExists(); // crear contenedor si no existe (ej. "archivos")
  const blobName = uniqueBlobName(originalName);
  const blockBlob: BlockBlobClient = container.getBlockBlobClient(blobName);

  await blockBlob.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: contentType,
      blobContentDisposition: `inline; filename="${originalName}"`,
    },
  });

  const url = blockBlob.url;
  return { url, blobName };
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
    console.warn('[AZURE_BLOB] URL no válida para eliminar:', blobUrl);
    return false;
  }

  const client = getBlobServiceClient();
  const container = client.getContainerClient(parsed.containerName);
  const blockBlob = container.getBlockBlobClient(parsed.blobName);
  const result = await blockBlob.deleteIfExists();
  return result.succeeded;
}

export function isAzureBlobConfigured(): boolean {
  return !!process.env.AZURE_STORAGE_CONNECTION_STRING;
}
