import { z } from "zod";

/**
 * Environment Configuration
 * 
 * Centralized environment variable validation and access using Zod.
 * This ensures type safety and validates that all required environment
 * variables are present at runtime.
 */

const envSchema = z.object({
  // Trigger.dev configuration
  TRIGGER_PROJECT_ID: z.string().optional().default("imessage-pipeline"),
  TRIGGER_SECRET_KEY: z.string().min(1, "TRIGGER_SECRET_KEY is required"),
  TRIGGER_API_URL: z.string().url().optional(),
  
  // LoopMessage configuration
  LOOP_AUTH_KEY: z.string().min(1, "LOOP_AUTH_KEY is required"),
  LOOP_SECRET_KEY: z.string().min(1, "LOOP_SECRET_KEY is required"),
  LOOP_SENDER_NAME: z.string().min(1, "LOOP_SENDER_NAME is required"),
  LOOP_WEBHOOK_SECRET_KEY: z.string().min(1, "LOOP_WEBHOOK_SECRET_KEY is required"),
  
  // SendBlue configuration
  SENDBLUE_API_KEY: z.string().min(1, "SENDBLUE_API_KEY is required"),
  SENDBLUE_API_SECRET: z.string().min(1, "SENDBLUE_API_SECRET is required"),
  SENDBLUE_NUMBER: z.string().min(1, "SENDBLUE_NUMBER is required"),
  SENDBLUE_WEBHOOK_SECRET: z.string().optional(),
  
  // AI configuration
  ECHO_API_KEY: z.string().min(1, "ECHO_API_KEY is required"),
  
  // Node environment
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
});

// Parse and validate environment variables
function parseEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    // During build time (e.g., Trigger.dev deploy), env vars may not be available
    // Log warning but don't throw to allow build to complete
    console.warn("⚠️  Environment validation failed (may be expected during build):");
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.warn(`  - ${err.path.join(".")}: ${err.message}`);
      });
    }
    // Return a partial object that TypeScript will accept
    return {} as z.infer<typeof envSchema>;
  }
}

// Export validated and typed environment configuration
// Note: During build time, this may be an empty object
let _env: z.infer<typeof envSchema> | null = null;

export const env = new Proxy({} as z.infer<typeof envSchema>, {
  get(target, prop: string) {
    if (!_env) {
      _env = parseEnv();
    }
    return _env[prop as keyof typeof _env];
  }
});

// Export individual config objects for easier access
// These are lazily evaluated when accessed
export const triggerConfig = {
  get projectId() { return env.TRIGGER_PROJECT_ID; },
  get secretKey() { return env.TRIGGER_SECRET_KEY; },
  get apiUrl() { return env.TRIGGER_API_URL; },
};

export const loopConfig = {
  get authKey() { return env.LOOP_AUTH_KEY; },
  get secretKey() { return env.LOOP_SECRET_KEY; },
  get senderName() { return env.LOOP_SENDER_NAME; },
  get webhookSecretKey() { return env.LOOP_WEBHOOK_SECRET_KEY; },
};

export const sendblueConfig = {
  get apiKey() { return env.SENDBLUE_API_KEY; },
  get apiSecret() { return env.SENDBLUE_API_SECRET; },
  get number() { return env.SENDBLUE_NUMBER; },
  get webhookSecret() { return env.SENDBLUE_WEBHOOK_SECRET; },
};

export const aiConfig = {
  get echoApiKey() { return env.ECHO_API_KEY; },
};

export type Env = z.infer<typeof envSchema>;

