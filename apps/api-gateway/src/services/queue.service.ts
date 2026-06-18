import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config";
import { prisma } from "../lib/prisma";
import { ingestDocument } from "./ai.service";
import { getPresignedUrl } from "./storage.service";

const connection = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null,
});

// ─── Queue ─────────────────────────────────────────────────────────────────────
export const ingestionQueue = new Queue(config.queues.ingestion, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export interface IngestionJobData {
  orgId: string;
  documentId: string;
  storageKey: string;
  documentType: string;
  documentName: string;
}

export async function enqueueIngestion(data: IngestionJobData): Promise<string> {
  const job = await ingestionQueue.add("ingest", data, {
    jobId: `ingest-${data.documentId}`,
  });
  return job.id!;
}

// ─── Worker ────────────────────────────────────────────────────────────────────
export function startIngestionWorker() {
  const worker = new Worker<IngestionJobData>(
    config.queues.ingestion,
    async (job: Job<IngestionJobData>) => {
      const { orgId, documentId, storageKey, documentType, documentName } = job.data;

      console.log(`🔄 Processing document ${documentId} for org ${orgId}`);

      // Mark as processing
      await prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: "PROCESSING" },
      });

      // URL sources store the raw URL in storageKey; file uploads use MinIO keys
      const fileUrl =
        documentType.toUpperCase() === "URL"
          ? storageKey
          : await getPresignedUrl(storageKey, 3600);

      // Call AI service to chunk + embed + store in Qdrant
      const result = await ingestDocument({
        orgId,
        documentId,
        fileUrl,
        documentType,
        documentName,
      });

      // Mark as ready
      await prisma.knowledgeDocument.update({
        where: { id: documentId },
        data: {
          status: "READY",
          chunkCount: result.chunkCount,
        },
      });

      console.log(`✅ Document ${documentId} ingested: ${result.chunkCount} chunks`);
    },
    {
      connection,
      concurrency: 3,
    }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    console.error(`❌ Ingestion job failed for doc ${job.data.documentId}:`, err.message);

    await prisma.knowledgeDocument.update({
      where: { id: job.data.documentId },
      data: {
        status: "FAILED",
        errorMessage: err.message.slice(0, 500),
      },
    });
  });

  console.log("✅ Ingestion worker started");
  return worker;
}
