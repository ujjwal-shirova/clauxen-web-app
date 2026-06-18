import { Queue, Worker } from "bullmq";
import { processProjectFile } from "@/backend/services/project-ingestion.service";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const QUEUE_NAME = "project-file-ingestion";

const connection = { url: REDIS_URL };

export const ingestionQueue = new Queue(QUEUE_NAME, { connection });

export function startIngestionWorker() {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const fileId = job.data.fileId as string;
      await processProjectFile(fileId);
    },
    { connection },
  );

  worker.on("failed", (job, err) => {
    console.error(`[ingestion-worker] job ${job?.id} failed:`, err);
  });

  worker.on("completed", (job) => {
    console.log(`[ingestion-worker] job ${job.id} completed`);
  });

  console.log("[ingestion-worker] listening for jobs…");
  return worker;
}
