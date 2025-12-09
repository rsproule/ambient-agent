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
  LOOP_WEBHOOK_SECRET_KEY: z
    .string()
    .min(1, "LOOP_WEBHOOK_SECRET_KEY is required"),

  // Pipedream configuration
  PIPEDREAM_CLIENT_ID: z.string().optional(),
  PIPEDREAM_CLIENT_SECRET: z.string().optional(),
  PIPEDREAM_PROJECT_ID: z.string().optional(),
  PIPEDREAM_PROJECT_ENVIRONMENT: z.string().optional().default("production"),
  PIPEDREAM_OAUTH_APP_ID: z.string().optional(),

  // NextAuth (using magic link authentication)
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required"),

  // Base URL
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),

  // Privy configuration
  NEXT_PUBLIC_PRIVY_APP_ID: z.string().optional(),
  PRIVY_APP_SECRET: z.string().optional(),

  // Blockchain configuration
  NEXT_PUBLIC_BASE_RPC_URL: z.string().url().optional(),

  // Payout wallet configuration (for USDC transfers)
  PAYOUT_WALLET_PRIVATE_KEY: z.string().optional(),
  PAYOUT_WALLET_ADDRESS: z.string().optional(),

  // Node environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .optional()
    .default("development"),
});

// Parse and validate environment variables
function parseEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    // During build time (e.g., Trigger.dev deploy), env vars may not be available
    // Log warning but don't throw to allow build to complete
    console.warn(
      "⚠️  Environment validation failed (may be expected during build):",
    );
    if (error instanceof z.ZodError) {
      error.issues.forEach((err: z.ZodIssue) => {
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
  },
});

// Export individual config objects for easier access
// These are lazily evaluated when accessed
export const triggerConfig = {
  get projectId() {
    return env.TRIGGER_PROJECT_ID;
  },
  get secretKey() {
    return env.TRIGGER_SECRET_KEY;
  },
  get apiUrl() {
    return env.TRIGGER_API_URL;
  },
};

export const loopConfig = {
  get authKey() {
    return env.LOOP_AUTH_KEY;
  },
  get secretKey() {
    return env.LOOP_SECRET_KEY;
  },
  get senderName() {
    return env.LOOP_SENDER_NAME;
  },
  get webhookSecretKey() {
    return env.LOOP_WEBHOOK_SECRET_KEY;
  },
};

export const pipedreamConfig = {
  get clientId() {
    return env.PIPEDREAM_CLIENT_ID;
  },
  get clientSecret() {
    return env.PIPEDREAM_CLIENT_SECRET;
  },
  get projectId() {
    return env.PIPEDREAM_PROJECT_ID;
  },
  get projectEnvironment() {
    return env.PIPEDREAM_PROJECT_ENVIRONMENT;
  },
  get oauthAppId() {
    return env.PIPEDREAM_OAUTH_APP_ID;
  },
};

export const nextAuthConfig = {
  get url() {
    return env.NEXTAUTH_URL;
  },
  get secret() {
    return env.NEXTAUTH_SECRET;
  },
};

export const privyConfig = {
  get appId() {
    return env.NEXT_PUBLIC_PRIVY_APP_ID;
  },
  get appSecret() {
    return env.PRIVY_APP_SECRET;
  },
};

export const blockchainConfig = {
  get baseRpcUrl() {
    return env.NEXT_PUBLIC_BASE_RPC_URL;
  },
};

export const payoutConfig = {
  get privateKey() {
    return env.PAYOUT_WALLET_PRIVATE_KEY;
  },
  get walletAddress() {
    return env.PAYOUT_WALLET_ADDRESS;
  },
};

export type Env = z.infer<typeof envSchema>;
