import winston from "winston";

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

/**
 * Human-readable format for local development
 */
const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  // Build context prefix from metadata
  const contextParts: string[] = [];
  if (meta.msgId) contextParts.push(`msg:${meta.msgId}`);
  if (meta.groupId) contextParts.push(`group:${meta.groupId}`);
  if (meta.sender) contextParts.push(`sender:${meta.sender}`);
  if (meta.conversationId) contextParts.push(`conv:${meta.conversationId}`);
  if (meta.component) contextParts.push(meta.component);

  const contextPrefix =
    contextParts.length > 0 ? `[${contextParts.join("][")}] ` : "";

  // Format additional data if present
  const { msgId, groupId, sender, conversationId, component, ...rest } = meta;
  const extraData =
    Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";

  return `${timestamp} ${level}: ${contextPrefix}${message}${extraData}`;
});

/**
 * Determine if we should use JSON format
 * - Default to JSON in production for log aggregation systems
 * - Use human-readable format in development
 */
const useJsonFormat =
  process.env.LOG_FORMAT === "json" ||
  (process.env.NODE_ENV === "production" &&
    process.env.LOG_FORMAT !== "pretty");

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" })
  ),
  transports: [
    new winston.transports.Console({
      format: useJsonFormat
        ? combine(
            timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
            json()
          )
        : combine(
            colorize({ all: true }),
            timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
            devFormat
          ),
    }),
  ],
  // Don't exit on uncaught exceptions in production
  exitOnError: false,
});

// Add file transport in production (if LOG_FILE is set)
if (process.env.LOG_FILE) {
  logger.add(
    new winston.transports.File({
      filename: process.env.LOG_FILE,
      format: combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
        json()
      ),
    })
  );
}

/**
 * Create a child logger with preset context
 * Useful for adding message/group/sender context to all logs in a request
 */
export function createContextLogger(context: {
  msgId?: string;
  groupId?: string;
  sender?: string;
  conversationId?: string;
  component?: string;
}) {
  return logger.child(context);
}

/**
 * Log context interface for structured logging
 */
export interface LogContext {
  msgId?: string;
  groupId?: string;
  sender?: string;
  conversationId?: string;
  component?: string;
  [key: string]: unknown;
}

export default logger;
