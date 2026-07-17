import * as Minio from "minio";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../config";
import { v4 as uuidv4 } from "uuid";

const minioClient = new Minio.Client({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

const MINIO_BUCKET = config.minio.bucket;

function createS3Client(): S3Client {
  return new S3Client({
    region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKeyId || "",
        secretAccessKey: config.s3.secretAccessKey || "",
    },
  });
}

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) s3Client = createS3Client();
  return s3Client;
}

function useS3(): boolean {
  return config.storage.provider === "s3";
}

export async function initStorage() {
  if (useS3()) {
    const client = getS3Client();
    const bucket = config.s3.bucket;
    if (!bucket) {
      throw new Error("AWS_S3_BUCKET is required when STORAGE_PROVIDER=s3");
    }
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      console.log(`✅ S3 bucket "${bucket}" ready (${config.s3.region})`);
    } catch (err: unknown) {
      const code = (err as { name?: string }).name;
      if (code === "NotFound" || code === "NoSuchBucket") {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
        console.log(`✅ S3 bucket "${bucket}" created`);
      } else {
        throw err;
      }
    }
    return;
  }

  const exists = await minioClient.bucketExists(MINIO_BUCKET);
  if (!exists) {
    await minioClient.makeBucket(MINIO_BUCKET, "ap-south-2");
    console.log(`✅ MinIO bucket "${MINIO_BUCKET}" created`);
  } else {
    console.log(`✅ MinIO bucket "${MINIO_BUCKET}" ready`);
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

  if (useS3()) {
    const client = getS3Client();
    const bucket = config.s3.bucket;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: params.buffer,
        ContentType: params.mimeType,
      })
    );
    const fileUrl = await getPresignedUrl(storageKey, 7 * 24 * 60 * 60);
    return { storageKey, fileUrl };
  }

  await minioClient.putObject(MINIO_BUCKET, storageKey, params.buffer, params.buffer.length, {
    "Content-Type": params.mimeType,
  });
  const fileUrl = await minioClient.presignedGetObject(
    MINIO_BUCKET,
    storageKey,
    7 * 24 * 60 * 60
  );
  return { storageKey, fileUrl };
}

export async function getPresignedUrl(storageKey: string, expirySeconds = 3600): Promise<string> {
  if (useS3()) {
    const client = getS3Client();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: config.s3.bucket, Key: storageKey }),
      { expiresIn: expirySeconds }
    );
  }
  return minioClient.presignedGetObject(MINIO_BUCKET, storageKey, expirySeconds);
}

export async function deleteFile(storageKey: string): Promise<void> {
  if (useS3()) {
    await getS3Client().send(
      new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: storageKey })
    );
    return;
  }
  await minioClient.removeObject(MINIO_BUCKET, storageKey);
}
