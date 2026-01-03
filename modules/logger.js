const winston = require("winston");
const path = require("path");
const fs = require("fs");

// ============================================================================
// Startup Validation: Required Environment Variables
// ============================================================================
const requiredEnvVars = ["NODE_ENV", "NAME_APP", "PATH_TO_LOGS"];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  process.stderr.write(
    `FATAL ERROR: Missing required environment variable(s): ${missingVars.join(", ")}\n`
  );
  process.exit(1);
}

// ============================================================================
// Environment Configuration
// ============================================================================
// Determine environment (three-tier system: development, testing, production)
const nodeEnv = process.env.NODE_ENV;
const isProduction = nodeEnv === "production";
const isTesting = nodeEnv === "testing";
const isDevelopment = nodeEnv === "development";

const appName = process.env.NAME_APP;
const logDir = process.env.PATH_TO_LOGS;

// Convert LOG_MAX_SIZE from megabytes to bytes (default: 5MB)
const maxSizeMB = parseInt(process.env.LOG_MAX_SIZE) || 5;
const maxSize = maxSizeMB * 1024 * 1024; // Convert MB to bytes

const maxFiles = parseInt(process.env.LOG_MAX_FILES) || 5;

// Determine log level based on environment
let logLevel;
if (isProduction) {
  logLevel = "info"; // Info and above in production (error, warn, info, http)
} else if (isTesting) {
  logLevel = "info"; // Info and above in testing (error, warn, info, http)
} else {
  logLevel = "debug"; // All levels in development
}

// Define log format for production (human-readable with timestamps)
const productionFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
    const stackStr = stack ? "\n" + stack : "";
    return `[${timestamp}] [${level.toUpperCase()}] [${appName}] ${message}${metaStr}${stackStr}`;
  })
);

// Define log format for development (colorized, simpler)
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
    const stackStr = stack ? "\n" + stack : "";
    return `${timestamp} ${level} [${appName}] ${message}${metaStr}${stackStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: logLevel,
  format: isProduction || isTesting ? productionFormat : developmentFormat,
  transports: [],
});

// ============================================================================
// Add transports based on environment
// ============================================================================
if (isProduction) {
  // Production: Log files only
  try {
    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    logger.add(
      new winston.transports.File({
        filename: path.join(logDir, `${appName}.log`),
        maxsize: maxSize,
        maxFiles: maxFiles,
        tailable: true,
      })
    );
  } catch (error) {
    // Fall back to console if file logging fails in production
    process.stderr.write(
      `WARNING: Failed to initialize file logging, falling back to console: ${error.message}\n`
    );
    logger.add(new winston.transports.Console());
  }
} else if (isTesting) {
  // Testing: Both console AND log files
  try {
    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Add file transport
    logger.add(
      new winston.transports.File({
        filename: path.join(logDir, `${appName}.log`),
        maxsize: maxSize,
        maxFiles: maxFiles,
        tailable: true,
      })
    );

    // Add console transport
    logger.add(new winston.transports.Console());
  } catch (error) {
    // Fall back to console only if file logging fails in testing
    process.stderr.write(
      `WARNING: Failed to initialize file logging, falling back to console only: ${error.message}\n`
    );
    logger.add(new winston.transports.Console());
  }
} else {
  // Development: Console output only
  logger.add(new winston.transports.Console());
}

// ============================================================================
// Export logger instance
// ============================================================================
module.exports = logger;
