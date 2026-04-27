import * as Minio from "minio";
import { config } from "../config";
import { v4 as uuidv4 } from "uuid";

const client = new Minio.Client({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

const BUCKET = config.minio.bucket;

// Ensure bucket exists on startup
export async function initStorage() {
  const exists = await client.bucketExists(BUCKET);
  if (!exists) {
    await client.makeBucket(BUCKET, "us-east-1");
    console.log(`✅ MinIO bucket "${BUCKET}" created`);
  }
}

export async function uploadFile(params: {
  orgId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<{ storageKey: string; fileUrl: string }> {
  const ext = params.fileName.split(".").pop() || "bin";
  const storageKey = `${params.orgId}/${uuidv4()}.${ext}`;

  await client.putObject(BUCKET, storageKey, params.buffer, params.buffer.length, {
    "Content-Type": params.mimeType,
  });

  // Generate a pre-signed URL valid for 7 days (for AI service to read)
  const fileUrl = await client.presignedGetObject(BUCKET, storageKey, 7 * 24 * 60 * 60);

  return { storageKey, fileUrl };
}

export async function getPresignedUrl(storageKey: string, expirySeconds = 3600): Promise<string> {
  return client.presignedGetObject(BUCKET, storageKey, expirySeconds);
}

export async function deleteFile(storageKey: string): Promise<void> {
  await client.removeObject(BUCKET, storageKey);
}
