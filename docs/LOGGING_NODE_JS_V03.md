# Node.js Logging Requirements

version 3.0.0

## Overview

This document specifies the logging requirements and implementation strategy for all Node.js applications using the Winston logging package. The approach is designed to minimize code changes during initial implementation while providing production-grade logging capabilities.

This version (V03) introduces a three-tier NODE_ENV system with distinct logging behaviors for development, testing, and production environments.

- This document uses the "NewsNexus10API" application as an example.

## Objectives

- Implement standardized logging across all Node.js applications
- Support production file-based logging with minimal code changes
- Enable gradual migration from `console.*` to Winston `logger` API
- Handle multi-process scenarios without file locking conflicts
- Maintain development-friendly console output
- Provide realistic production-like logging during testing
- Minimize production log volume by logging only errors

## Framework Coverage

This logging strategy applies to:

- **Express.js applications** (e.g., NewsNexus10API, TheServerManagerAPI)
- **Next.js applications** (server-side only)
- **Node.js scripts** (running as parent or child processes)

## Configuration

### Environment Variables

The following environment variables control logging behavior:

| Variable                        | Required                  | Description                                                                     | Example                          |
| ------------------------------- | ------------------------- | ------------------------------------------------------------------------------- | -------------------------------- |
| `NODE_ENV`                      | Yes                       | Environment mode                                                                | `development`, `testing`, or `production` |
| `NAME_APP`                      | Yes                       | Application identifier for log filenames (parent process)                       | `NewsNexus10API`                 |
| `NAME_CHILD_PROCESS`            | Yes (for child processes) | Child process identifier for log filenames (single child process scenario)      | `NewsNexus10API_Worker`          |
| `NAME_CHILD_PROCESS_[descriptor]` | Yes (for child processes) | Child process identifier for specific child types (multi-child process scenario) | `NewsNexus10API_BackupService`   |
| `PATH_TO_LOGS`                  | Testing & Production      | Directory path for log file storage (shared by parent and child processes)      | `/var/log/newsnexus`             |
| `LOG_MAX_SIZE`                  | No                        | Maximum size per log file (default: 10MB)                                       | `10485760` (bytes)               |
| `LOG_MAX_FILES`                 | No                        | Maximum number of log files to retain (default: 10)                             | `10`                             |

**Child Process Naming Convention**:
- For a single child process type: Use `NAME_CHILD_PROCESS`
- For multiple child process types: Use `NAME_CHILD_PROCESS_[descriptor]` where `[descriptor]` identifies the child process type (e.g., `WORKER`, `BACKUP`, `CLEANUP`)
- Parent process passes `PATH_TO_LOGS`, `LOG_MAX_SIZE`, and `LOG_MAX_FILES` to child processes
- Missing child process name variables will trigger a fatal error with descriptive messaging

### Next.js Specific Overrides

For Next.js applications, the standard environment variables can be overridden or supplemented to match Next.js conventions:

| Standard Variable | Next.js Equivalent | Description                                                                                                                                        |
| ----------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`        | `NEXT_PUBLIC_MODE` | Used to determine if the app is in `development`, `testing`, or `production` mode for logging purposes. If `NEXT_PUBLIC_MODE` is present, it takes precedence. |

**Note**: In Next.js, environment variables intended for the browser must start with `NEXT_PUBLIC_`. While logging configuration is server-side, using `NEXT_PUBLIC_MODE` allows for a consistent environment usage across the stack if desired.

### Log Levels

Winston log levels used (in order of priority):

1. `error` - Error conditions requiring attention
2. `warn` - Warning conditions that should be reviewed
3. `info` - Informational messages about application state
4. `http` - HTTP request/response logging
5. `verbose` - Detailed operational information
6. `debug` - Debug-level messages for troubleshooting
7. `silly` - Extremely detailed diagnostic information

## Implementation Strategy

### Phase 1: Monkey-Patching (Initial Implementation)

Use Winston to intercept existing `console.*` calls without changing application code:

- **Approach**: Override global `console` object methods
- **Benefit**: Zero code changes required initially
- **Console Method Mapping**:
  - `console.error()` → Winston `error` level
  - `console.warn()` → Winston `warn` level
  - `console.info()` → Winston `info` level
  - `console.log()` → Winston `info` level
  - `console.debug()` → Winston `debug` level

### Phase 2: Gradual Migration (Future)

Over time, replace `console.*` calls with direct Winston `logger` usage:

```javascript
// Old approach
console.log("User authenticated:", userId);

// New approach
logger.info("User authenticated", { userId });
```

**Benefits of migration**:

- Structured logging with metadata objects
- Better log level control
- Enhanced searchability and filtering
- Consistent formatting

## Multi-Process Strategy

### Parent Processes

**Behavior**: Environment-dependent (see Environment-Specific Behavior section)

- Express.js servers
- Next.js server processes
- Standalone Node.js applications
- Main application processes (running under systemd in production)

**Configuration**:

```javascript
// Production
- File transport: Write only ERROR level to rotating log files using NAME_APP
- Format: Human-readable with timestamps

// Testing
- File transport: Write all log levels to rotating log files using NAME_APP
- Format: Human-readable with timestamps

// Development
- Console transport only
- Format: Colorized human-readable
- All log levels enabled
```

### Child Processes

**Behavior**: Write to their own separate log files (testing/production), console in development

- Node.js scripts spawned by parent processes
- Worker processes
- Background job runners

**Implementation**:

```javascript
// Production
- File transport: Write only ERROR level to rotating log files using NAME_CHILD_PROCESS or NAME_CHILD_PROCESS_[descriptor]
- Same PATH_TO_LOGS directory as parent
- Independent log files prevent file locking conflicts
- Child logs include process identifier

// Testing
- File transport: Write all log levels to rotating log files using NAME_CHILD_PROCESS or NAME_CHILD_PROCESS_[descriptor]
- Same PATH_TO_LOGS directory as parent
- Independent log files prevent file locking conflicts
- Child logs include process identifier

// Development
- Console transport only
- Format: Colorized human-readable
- All log levels enabled
```

**Environment Variable Requirements**:
- Child processes MUST have `NAME_CHILD_PROCESS` or `NAME_CHILD_PROCESS_[descriptor]` set
- Parent passes `PATH_TO_LOGS`, `LOG_MAX_SIZE`, and `LOG_MAX_FILES` to child via environment
- Missing `NAME_CHILD_PROCESS*` triggers fatal error at both spawn time (parent) and initialization (child)

**Rationale**: Each process writes to its own log file, preventing file locking conflicts and resource contention. Separate files enable independent log rotation and easier troubleshooting of specific child processes.

## Environment-Specific Behavior

### Production Mode (`NODE_ENV=production`)

**Parent Processes**:

- Write **only ERROR level** logs to rotating log files in `PATH_TO_LOGS` directory
- Filename pattern: `${NAME_APP}.log` (with rotation numbers: `.1.log`, `.2.log`, etc.)
- File rotation: Size-based (default 10MB per file)
- Retention: Keep last 10 files by default
- Format: Human-readable text with timestamps
- No console output (unless explicitly configured)
- Log level: `error` only

**Child Processes**:

- Write **only ERROR level** logs to their own rotating log files in `PATH_TO_LOGS` directory
- Filename pattern: `${NAME_CHILD_PROCESS}.log` or `${NAME_CHILD_PROCESS_[descriptor]}.log`
- File rotation: Size-based (inherited from parent via `LOG_MAX_SIZE`)
- Retention: Inherited from parent via `LOG_MAX_FILES`
- Format: Human-readable text with timestamps
- Include process identifier (NAME_CHILD_PROCESS + PID) in log messages
- No console output (unless explicitly configured)
- Log level: `error` only

**Rationale**: In production, only critical errors need to be captured to minimize log volume, storage costs, and I/O overhead. Non-error conditions should be monitored through other means (metrics, health checks, etc.).

### Testing Mode (`NODE_ENV=testing`)

**Parent Processes**:

- Write **all log levels** to rotating log files in `PATH_TO_LOGS` directory
- Filename pattern: `${NAME_APP}.log` (with rotation numbers: `.1.log`, `.2.log`, etc.)
- File rotation: Size-based (default 10MB per file)
- Retention: Keep last 10 files by default
- Format: Human-readable text with timestamps
- No console output (unless explicitly configured)
- Log level: `info` (captures error, warn, info, http levels)

**Child Processes**:

- Write **all log levels** to their own rotating log files in `PATH_TO_LOGS` directory
- Filename pattern: `${NAME_CHILD_PROCESS}.log` or `${NAME_CHILD_PROCESS_[descriptor]}.log`
- File rotation: Size-based (inherited from parent via `LOG_MAX_SIZE`)
- Retention: Inherited from parent via `LOG_MAX_FILES`
- Format: Human-readable text with timestamps
- Include process identifier (NAME_CHILD_PROCESS + PID) in log messages
- No console output (unless explicitly configured)
- Log level: `info` (captures error, warn, info, http levels)

**Rationale**: Testing mode simulates production file-based logging but captures all log levels to aid in debugging test failures and understanding application behavior during test runs.

### Development Mode (`NODE_ENV=development`)

**All Processes** (Parent and Child):

- Console output only
- No file writing
- Colorized output for better readability
- More verbose logging levels enabled
- Immediate output (no buffering)
- Log level: `debug` (captures all levels including silly)

**Rationale**: Development mode prioritizes developer experience with immediate, colorized console feedback and verbose logging to aid in local debugging.

## Log Format Specification

### Human-Readable Format (Production and Testing Files)

```
[2025-12-29 14:32:15.234] [ERROR] [NewsNexus10API] Database connection failed { error: "ECONNREFUSED", host: "localhost", port: 5432 }
[2025-12-29 14:32:16.891] [WARN] [NewsNexus10API] API rate limit approaching { endpoint: "/articles", remaining: 10 }
[2025-12-29 14:32:17.456] [INFO] [NewsNexus10API] User authentication successful { userId: 123, email: "user@example.com" }
```

**Format Components**:

- Timestamp in ISO format with milliseconds
- Log level in uppercase
- Application name from `NAME_APP` env variable
- Message string
- Metadata object (if provided) in JSON format

### Console Format (Development)

```
14:32:15 ERROR [NewsNexus10API] Database connection failed { error: "ECONNREFUSED" }
14:32:16 WARN  [NewsNexus10API] API rate limit approaching { remaining: 10 }
14:32:17 INFO  [NewsNexus10API] User authentication successful { userId: 123 }
```

**Format Components**:

- Time only (no date for cleaner output)
- Colorized log level
- Application name
- Message and metadata

### Child Process Log Markers

Child process logs include process identification using their dedicated name and PID:

```
[2025-12-29 14:32:15.234] [ERROR] [NewsNexus10API_Worker:12345] Background job failed { jobId: 789, error: "Timeout" }
[2025-12-29 14:32:16.891] [INFO] [NewsNexus10API_BackupService:12346] Backup initiated { backupId: 456 }
```

Format: `[NAME_CHILD_PROCESS:PID]` or `[NAME_CHILD_PROCESS_[descriptor]:PID]`

## File Rotation Strategy

### Size-Based Rotation

- **Trigger**: File size exceeds `LOG_MAX_SIZE` (default 10MB)
- **Naming**: `${NAME_APP}.log`, `${NAME_APP}.1.log`, `${NAME_APP}.2.log`, etc.
- **Retention**: Keep last `LOG_MAX_FILES` files (default 10)
- **Compression**: Optional gzip compression for rotated files

### Example File Structure

```
/var/log/newsnexus/
├── NewsNexus10API.log                    # Current parent process log
├── NewsNexus10API.1.log                  # Previous parent rotation
├── NewsNexus10API.2.log                  # Older parent rotation
├── NewsNexus10API_Worker.log             # Current child process log
├── NewsNexus10API_Worker.1.log           # Previous child rotation
├── NewsNexus10API_BackupService.log      # Current backup service log
└── NewsNexus10API_BackupService.1.log    # Previous backup rotation
```

Each process maintains its own independent log file and rotation history.

## Error Handling

### Log Directory Issues

**Missing Directory**:

```javascript
// Create PATH_TO_LOGS directory if it doesn't exist
// Fail gracefully and fall back to console logging
// Log warning about directory creation
```

**Permission Denied**:

```javascript
// Catch EACCES errors
// Fall back to console logging
// Emit warning to stderr
```

**Disk Space Issues**:

```javascript
// Handle ENOSPC errors
// Attempt to rotate/clean old files
// Fall back to console logging if unable to write
```

## Framework-Specific Considerations

### Express.js Applications

**Integration Points**:

1. Initialize Winston logger before requiring routes
2. Add HTTP request logging middleware
3. Capture uncaught exceptions and unhandled rejections
4. Log server startup and shutdown events

**HTTP Request Logging**:

```javascript
// Use morgan or custom middleware
// Log format: [timestamp] [HTTP] METHOD /path STATUS duration ms
logger.http("GET /api/articles 200 45ms", {
  method: "GET",
  url: "/api/articles",
  status: 200,
  duration: 45,
});
```

### Next.js Applications

**Server-Side Only**:

- Apply logging to Next.js API routes and server components
- **Do not** attempt to use file logging in client-side code
- Client-side logging should remain as console output (browser handles it)

**Detection**:

```javascript
// Only initialize file logging if running on server
if (typeof window === "undefined") {
  // Server-side: Initialize Winston with file transport
} else {
  // Client-side: Use console only (no Winston needed)
}
```

### Child Process Scripts

**Implementation**:

```javascript
// Detect if running as child process
const isChildProcess = process.send !== undefined;

if (isChildProcess) {
  // Production: Write only errors to own log file using NAME_CHILD_PROCESS or NAME_CHILD_PROCESS_[descriptor]
  // Testing: Write all levels to own log file using NAME_CHILD_PROCESS or NAME_CHILD_PROCESS_[descriptor]
  // Development: Console output only
  // FATAL ERROR if NAME_CHILD_PROCESS* is not defined
} else {
  // Use standard parent process configuration with NAME_APP
}
```

**Process Identification**:

```javascript
// Child processes use NAME_CHILD_PROCESS or NAME_CHILD_PROCESS_[descriptor] with PID
const childProcessName = process.env.NAME_CHILD_PROCESS || process.env.NAME_CHILD_PROCESS_WORKER; // Example
if (!childProcessName) {
  console.error('FATAL ERROR: Child process requires NAME_CHILD_PROCESS or NAME_CHILD_PROCESS_[descriptor] environment variable');
  process.exit(1);
}
const processId = `${childProcessName}:${process.pid}`;
// Include in log format
```

**Parent Spawning Child Processes**:

When a parent spawns a child process, it must:
1. Verify the appropriate `NAME_CHILD_PROCESS*` variable exists in the environment
2. Pass necessary environment variables to the child: `PATH_TO_LOGS`, `LOG_MAX_SIZE`, `LOG_MAX_FILES`, `NODE_ENV`
3. Trigger a fatal error if `NAME_CHILD_PROCESS*` is missing

```javascript
// Parent validation before spawning child
const childProcessName = process.env.NAME_CHILD_PROCESS || process.env.NAME_CHILD_PROCESS_WORKER;
if (!childProcessName) {
  logger.error('FATAL ERROR: Cannot spawn child process - missing NAME_CHILD_PROCESS or NAME_CHILD_PROCESS_[descriptor] in environment');
  process.exit(1);
}

// Spawn child with inherited environment
const child = spawn('node', ['./worker.js'], {
  env: {
    ...process.env, // Passes all env variables including NAME_CHILD_PROCESS*, PATH_TO_LOGS, etc.
  }
});
```

## Winston Configuration Template

### Parent Process (All Environments)

```javascript
const winston = require("winston");
const path = require("path");

// Determine environment
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

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
    return `[${timestamp}] [${level.toUpperCase()}] [${appName}] ${message}${metaStr}`;
  })
);

// Create logger
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  transports: [],
});

// Add transports based on environment
if (isProduction || isTesting) {
  // Production and Testing: Write to files
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, `${appName}.log`),
      maxsize: maxSize,
      maxFiles: maxFiles,
      tailable: true,
    })
  );
} else {
  // Development: Console only
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

// Monkey-patch console methods
console.log = (...args) => logger.info(args.join(" "));
console.error = (...args) => logger.error(args.join(" "));
console.warn = (...args) => logger.warn(args.join(" "));
console.info = (...args) => logger.info(args.join(" "));
console.debug = (...args) => logger.debug(args.join(" "));

module.exports = logger;
```

### Child Process (All Environments)

```javascript
const winston = require("winston");
const path = require("path");

// Validate NAME_CHILD_PROCESS* is set (FATAL ERROR if missing)
const childProcessName =
  process.env.NAME_CHILD_PROCESS ||
  Object.keys(process.env).find(key => key.startsWith('NAME_CHILD_PROCESS_'))?.let(key => process.env[key]);

if (!childProcessName) {
  console.error(
    "FATAL ERROR: Child process requires NAME_CHILD_PROCESS or NAME_CHILD_PROCESS_[descriptor] environment variable.\n" +
    "Please add the appropriate variable to the parent process .env file.\n" +
    "Example: NAME_CHILD_PROCESS=MyApp_Worker or NAME_CHILD_PROCESS_BACKUP=MyApp_BackupService"
  );
  process.exit(1);
}

// Determine environment
const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";
const isTesting = nodeEnv === "testing";
const isDevelopment = nodeEnv === "development";

const logDir = process.env.PATH_TO_LOGS || "./logs";
const maxSize = parseInt(process.env.LOG_MAX_SIZE) || 10485760; // 10MB
const maxFiles = parseInt(process.env.LOG_MAX_FILES) || 10;
const processId = `${childProcessName}:${process.pid}`;

// Determine log level based on environment
let logLevel;
if (isProduction) {
  logLevel = "error"; // Only errors in production
} else if (isTesting) {
  logLevel = "info"; // Info and above in testing
} else {
  logLevel = "debug"; // All levels in development
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
    return `[${timestamp}] [${level.toUpperCase()}] [${processId}] ${message}${metaStr}`;
  })
);

// Create logger
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  transports: [],
});

// Add transports based on environment
if (isProduction || isTesting) {
  // Production and Testing: Write to files
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, `${childProcessName}.log`),
      maxsize: maxSize,
      maxFiles: maxFiles,
      tailable: true,
    })
  );
} else {
  // Development: Console only
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

// Monkey-patch console methods
console.log = (...args) => logger.info(args.join(" "));
console.error = (...args) => logger.error(args.join(" "));
console.warn = (...args) => logger.warn(args.join(" "));
console.info = (...args) => logger.info(args.join(" "));
console.debug = (...args) => logger.debug(args.join(" "));

module.exports = logger;
```

## Migration Path

### Timeline

1. **Immediate**: Implement monkey-patching approach

   - Add Winston dependency
   - Create logger initialization module
   - Require logger at application entry point
   - Test in all three environments (development, testing, production)

2. **Short-term** (as code is modified):

   - Replace critical `console.*` calls with `logger.*` in error handling
   - Update new code to use `logger.*` directly
   - Add structured metadata to important log statements

3. **Long-term** (during major refactoring):
   - Systematically replace all `console.*` with `logger.*`
   - Remove monkey-patching code
   - Enhance logging with contextual metadata

### Migration Example

```javascript
// Phase 1: Existing code (monkey-patched)
console.log("User logged in:", email);
// Development: Console output
// Testing: [timestamp] [INFO] [app] User logged in: user@example.com
// Production: Not logged (info level filtered out)

console.error("Database error:", error);
// All environments: Logged as ERROR

// Phase 2: Direct logger usage with structured data
logger.info("User logged in", { email, userId, ip: req.ip });
// Development: Console output
// Testing: [timestamp] [INFO] [app] User logged in { "email": "...", "userId": 123, "ip": "..." }
// Production: Not logged (info level filtered out)

logger.error("Database error", { error: error.message, stack: error.stack });
// All environments: Logged as ERROR with full context
```

## Testing

### Verification Steps

1. **Development Mode**:

   - Start application with `NODE_ENV=development`
   - Verify logs appear in console
   - Verify no log files are created
   - Check colorized output
   - Verify all log levels are displayed

2. **Testing Mode**:

   - Start application with `NODE_ENV=testing` and `PATH_TO_LOGS` set
   - Verify log files are created in specified directory
   - Verify all log levels (error, warn, info, http) are written to files
   - Verify file rotation occurs at size limit
   - Check no console output

3. **Production Mode**:

   - Start application with `NODE_ENV=production` and `PATH_TO_LOGS` set
   - Verify log files are created in specified directory
   - Verify only ERROR level logs are written to files
   - Verify info, warn, debug logs are NOT written
   - Verify file rotation occurs at size limit
   - Check no console output

4. **Child Processes**:

   - Verify `NAME_CHILD_PROCESS` or `NAME_CHILD_PROCESS_[descriptor]` is set in parent .env
   - Spawn child process from parent
   - Verify child creates its own log file in testing/production
   - Verify child uses console output in development
   - Check process ID (NAME_CHILD_PROCESS:PID) appears in child logs
   - Verify fatal error occurs when NAME_CHILD_PROCESS* is missing
   - Verify child respects same log level filtering as parent based on NODE_ENV

5. **Error Handling**:
   - Test with invalid `PATH_TO_LOGS`
   - Test with no write permissions
   - Verify graceful fallback to console

## Best Practices

### Do's

- Always include contextual metadata in structured logs
- Use appropriate log levels for different message types
- Log application lifecycle events (startup, shutdown, crashes)
- Log all errors with stack traces
- Include request IDs for tracing across logs
- Sanitize sensitive data (passwords, tokens) before logging
- Use `logger.error()` for all error conditions to ensure they're captured in production

### Don'ts

- Don't log sensitive user data (passwords, credit cards, PII)
- Don't use info/debug logging for production monitoring (use metrics instead)
- Don't use synchronous file operations in logging code
- Don't catch and suppress logging errors without fallback
- Don't log entire large objects (summarize or truncate)
- Don't rely on info/warn/debug logs being available in production

## Security Considerations

### Data Sanitization

```javascript
// BAD: Logging sensitive data
logger.info("User login attempt", { email, password });

// GOOD: Sanitize sensitive fields
logger.info("User login attempt", {
  email,
  passwordProvided: !!password,
});
```

### Log File Permissions

- Set restrictive permissions on log directory (750 or 700)
- Set restrictive permissions on log files (640 or 600)
- Ensure only application user and administrators can read logs
- Consider log encryption for highly sensitive applications

### Log Retention

- Define retention policy (default: 10 files)
- Implement automated cleanup of old logs
- Consider archiving logs to secure storage
- Comply with data retention regulations

## Troubleshooting

### Common Issues

**Issue**: Logs not appearing in file

- Check `NODE_ENV` is set to `production` or `testing`
- Verify `PATH_TO_LOGS` directory exists and is writable
- Check application has write permissions
- Review error output for Winston initialization errors

**Issue**: Too many/few logs in production

- Verify `NODE_ENV` is exactly `production` (not `prod` or other variants)
- Check log level is set to `error` for production
- Review code to ensure errors are logged at `error` level, not `info` or `warn`

**Issue**: Multiple processes writing to same file

- This should not occur with the new architecture
- Verify child processes have unique `NAME_CHILD_PROCESS` or `NAME_CHILD_PROCESS_[descriptor]` values
- Check that child processes are using their own NAME_CHILD_PROCESS* variable, not NAME_APP
- Ensure each child process writes to its own log file

**Issue**: Log files growing too large

- Reduce `LOG_MAX_SIZE` environment variable
- Decrease `LOG_MAX_FILES` retention count
- Review and reduce logging verbosity
- Implement more aggressive rotation strategy
- Verify production is using `error` log level only

**Issue**: Performance degradation

- Ensure using asynchronous transports (Winston default)
- Verify production is only logging errors
- Consider using `logger.http` level for request logs and disable in production
- Profile application to identify logging bottlenecks

**Issue**: Fatal error "Child process requires NAME_CHILD_PROCESS"

- Add `NAME_CHILD_PROCESS` or `NAME_CHILD_PROCESS_[descriptor]` to parent's .env file
- For single child type: Use `NAME_CHILD_PROCESS=YourApp_ChildName`
- For multiple child types: Use `NAME_CHILD_PROCESS_WORKER=YourApp_Worker`, `NAME_CHILD_PROCESS_BACKUP=YourApp_Backup`, etc.
- Ensure the parent process has the environment variable set before spawning children
- Restart parent process after adding environment variable

## Dependencies

Required npm packages:

```json
{
  "dependencies": {
    "winston": "^3.11.0",
    "winston-daily-rotate-file": "^4.7.1"
  }
}
```

Note: `winston-daily-rotate-file` is optional and only needed if switching from size-based to date-based rotation in the future.

## Key Changes from V02

### Three-Tier NODE_ENV System

V03 introduces explicit handling for three distinct environments:

| Environment | Log Output | Log Levels | Use Case |
|-------------|-----------|------------|----------|
| `development` | Console | All (debug+) | Local development with immediate feedback |
| `testing` | Files | Info+ (error, warn, info, http) | Test environments with production-like logging |
| `production` | Files | Error only | Production environments with minimal log volume |

### Production Error-Only Logging

The most significant change in V03 is that production environments now only log ERROR level messages:

- **V02 Behavior**: Production logged all levels (info, warn, error, etc.)
- **V03 Behavior**: Production logs ONLY error level
- **Rationale**: Reduces log volume, storage costs, and I/O overhead while capturing critical errors

### Testing Environment

V03 adds explicit support for a testing environment:

- Behaves like V02 production (file-based logging with all levels)
- Allows realistic testing of production logging behavior
- Captures full log context for test debugging

### Development Remains Unchanged

Development behavior is consistent with V02:
- Console output only
- All log levels enabled
- No file writing

## Migration from V02 to V03

If you're migrating from V02 to V03, be aware:

1. **Production Log Volume**: Production logs will be significantly smaller (errors only)
2. **Testing Environment**: Add `NODE_ENV=testing` to your test environments if you need file-based logging during tests
3. **Monitoring Strategy**: Info/warn logs won't appear in production - use metrics, health checks, or structured monitoring for non-error conditions
4. **Code Changes**: Review error handling to ensure all errors are logged at `error` level, not `info` or `warn`

## References

- [Winston Documentation](https://github.com/winstonjs/winston)
- [Winston Best Practices](https://github.com/winstonjs/winston/blob/master/docs/transports.md)
- [Node.js Logging Best Practices](https://nodejs.org/en/docs/guides/diagnostics/)

## Revision History

| Date       | Version | Changes                                                                                                   |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------- |
| 2025-12-21 | 1.0.0   | Initial requirements document                                                                             |
| 2025-12-25 | 2.1.0   | Updated child process logging to write to own log files; added NAME_CHILD_PROCESS* environment variables |
| 2025-12-29 | 3.0.0   | Introduced three-tier NODE_ENV system (development, testing, production); production now logs errors only |

---

**Document Status**: Active
**Owner**: Development Team for Nick Rodriguez Projects
**Last Updated**: 2025-12-29
