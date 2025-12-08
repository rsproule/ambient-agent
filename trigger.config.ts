import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";
import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_euezzwlhugsyhvjaodyk",
  runtime: "node",
  logLevel: "info",
  maxDuration: 300, // 5 minutes max duration for tasks
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
  build: {
    extensions: [
      prismaExtension({
        schema: "prisma/schema.prisma",
        mode: "legacy",
      }),
    ],
  },
  telemetry: {
    exporters: [
      new OTLPTraceExporter({
        url: process.env.SIGNOZ_OTLP_ENDPOINT,
        headers: {
          "signoz-ingestion-key": process.env.SIGNOZ_INGESTION_KEY!,
        },
      }),
    ],
    logExporters: [
      new OTLPLogExporter({
        url: process.env.SIGNOZ_OTLP_ENDPOINT,
        headers: {
          "signoz-ingestion-key": process.env.SIGNOZ_INGESTION_KEY!,
        },
      }),
    ],
  },
});
