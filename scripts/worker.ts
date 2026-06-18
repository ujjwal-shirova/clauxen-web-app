#!/usr/bin/env tsx
import { startIngestionWorker } from "@/projects/queue/ingestion";

startIngestionWorker();

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
