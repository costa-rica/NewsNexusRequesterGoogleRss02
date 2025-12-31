const winston = require("winston");
const path = require("path");
const fs = require("fs");

// Determine environment (three-tier system: development, testing, production)
const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";
const isTesting = nodeEnv === "testing";
const isDevelopment = nodeEnv === "development";

const appName = process.env.NAME_APP || "app";
const logDir = process.env.PATH_TO_LOGS || "./logs";
const maxSize = parseInt(process.env.LOG_MAX_SIZE) || 10485760; // 10MB
const maxFiles = parseInt(process.env.LOG_MAX_FILES) || 10;

// Determine log level based on environment
let logLevel;
if (isProduction) {
  logLevel = "error"; // Only errors in production
} else if (isTesting) {
  logLevel = "info"; // Info and above in testing
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

// Add transports based on environment
if (isProduction || isTesting) {
  // Production and Testing: Write to rotating log files
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
    // Fall back to console if file logging fails
    console.error(
      "WARNING: Failed to initialize file logging, falling back to console:",
      error.message
    );
    logger.add(new winston.transports.Console());
  }
} else {
  // Development: Console output only
  logger.add(new winston.transports.Console());
}

// Monkey-patch console methods to use Winston
console.log = (...args) => logger.info(args.join(" "));
console.error = (...args) => logger.error(args.join(" "));
console.warn = (...args) => logger.warn(args.join(" "));
console.info = (...args) => logger.info(args.join(" "));
console.debug = (...args) => logger.debug(args.join(" "));

// Export logger for direct usage (Phase 2 migration)
module.exports = logger;
