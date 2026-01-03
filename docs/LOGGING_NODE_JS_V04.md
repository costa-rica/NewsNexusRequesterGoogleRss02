# Node.js Logging Requirements V04

## Overview

This document specifies logging requirements for Node.js applications using Winston. These requirements apply to both standard Node.js and Next.js applications.

## Pre-Implementation: Console Statement Migration

**IMPORTANT: This step is for human developers only, NOT for AI agents.**

Before implementing Winston logging, manually search and replace all console statements:

| Search | Replace |
|--------|---------|
| `console.log` | `logger.info` |
| `console.error` | `logger.error` |
| `console.warn` | `logger.warn` |
| `console.info` | `logger.info` |
| `console.debug` | `logger.debug` |

**Workflow:**
1. Create a new branch
2. Perform search and replace operations in your IDE
3. Commit changes to the branch
4. Then proceed with AI agent to implement Winston logger

## Logging Modes

### Development Mode
- **Output**: Console only
- **Log Files**: None created
- **Use Case**: Local development

### Testing Mode
- **Output**: Console AND log files (both simultaneously)
- **Log Files**: Rotating files with retention
- **Use Case**: Automated testing, staging environments

### Production Mode
- **Output**: Log files only
- **Log Files**: Rotating files with retention
- **Use Case**: Production deployments

## Environment Variables

### Required Variables

**NODE_ENV** (required)
- Values: `development`, `testing`, or `production`
- Determines logging mode
- Next.js fallback: Use `NEXT_PUBLIC_MODE` if `NODE_ENV` is not set

**NAME_APP** (required)
- Application identifier
- Used as log file name: `[NAME_APP].log`
- Rotated files: `[NAME_APP]1.log`, `[NAME_APP]2.log`, etc.

**PATH_TO_LOGS** (required)
- Absolute path to log directory
- Must exist or be creatable by the application

**NAME_CHILD_PROCESS_[descriptor]** (required for apps with child processes)
- Parent process passes child process name via this variable
- Child receives value as its `NAME_APP`
- Example: `NAME_CHILD_PROCESS_SCORER=NewsNexusSemanticScorer02`

### Optional Variables

**LOG_MAX_SIZE**
- Default: `5` (megabytes)
- Specify value in megabytes (e.g., `5` = 5MB)
- Logger implementation converts to bytes internally for Winston
- Maximum size of each log file before rotation

**LOG_MAX_FILES**
- Default: `5`
- Number of rotated log files to retain

## Logger File Placement

The logger configuration file should be placed based on existing project structure:

1. Check for existing config directories in this order:
   - `config/`
   - `src/config/`
   - `lib/config/`
   - `src/lib/config/`
2. If any of these directories exist, place `logger.js` (or `logger.ts`) there
3. If none exist, ask the user where they want the logger file placed (e.g., `modules/`, `lib/`, `utils/`, etc.)

## Configuration File Location

Standard Node.js applications use `.env` files. Next.js applications should check for `.env.local` if `.env` is not found.

## Initialization Requirements

### Startup Validation

Environment variable validation occurs in the logger configuration file before logger initialization:

1. Validate all required variables are present (`NODE_ENV`, `NAME_APP`, `PATH_TO_LOGS`)
2. If any required variable is missing:
   - Output fatal error to stderr identifying the specific missing variable
   - Exit immediately with non-zero exit code (e.g., `process.exit(1)`)
   - Do NOT proceed with logger initialization or application startup

### Logger Implementation

- Logger must be initialized before any other application code runs
- Main application file (e.g., `index.js`) should load dotenv first, then require the logger configuration file
- Export a singleton logger instance for use throughout the application
- See "Logger File Placement" section for file location guidance

## Log Levels

Winston log levels (in order of severity):

1. **error** - Error conditions requiring immediate attention
2. **warn** - Warning conditions that should be reviewed
3. **info** - Informational messages about application state
4. **http** - HTTP request/response logging
5. **debug** - Detailed debugging information

### Environment-Specific Levels

- **Development**: All levels (debug and above)
- **Testing**: info and above (error, warn, info, http)
- **Production**: info and above (error, warn, info, http)

## Child Process Handling

- Each child process manages its own Winston logger instance
- Parent process passes `NAME_CHILD_PROCESS_[descriptor]` value to child as `NAME_APP`
- Child inherits all other logging environment variables (`NODE_ENV`, `PATH_TO_LOGS`, `LOG_MAX_SIZE`, `LOG_MAX_FILES`)
- Child and parent log to separate files based on their respective `NAME_APP` values

## File Rotation

- Use Winston's file rotation transport
- Rotation triggers when file size exceeds `LOG_MAX_SIZE`
- Retain only `LOG_MAX_FILES` most recent files
- Older files are automatically deleted

## Implementation Checklist

- [ ] Migrate console statements to logger calls (human task)
- [ ] Install Winston package: `npm install winston`
- [ ] Create logger configuration file (see "Logger File Placement" section)
- [ ] Implement environment variable validation at startup
- [ ] Configure Winston transports for each mode
- [ ] Set up file rotation with configured limits
- [ ] Test all three modes (development, testing, production)
- [ ] Verify child process logging (if applicable)
- [ ] Confirm fatal errors on missing required variables
