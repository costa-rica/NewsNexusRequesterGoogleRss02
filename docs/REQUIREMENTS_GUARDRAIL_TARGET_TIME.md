# Guardrail Time Configuration Requirements

## Overview
Implement configurable time guardrails using environment variables to control when scripts can run.

## Environment Variables

### Required Variables
```bash
# Time Guardrail Configuration
GUARDRAIL_TARGET_TIME=23:00              # Default: "23:00" (HH:MM format, 24-hour clock)
GUARDRAIL_TARGET_WINDOW_IN_MINS=5        # Default: 5 (minutes before/after target)
```

## Implementation Requirements

### 1. Parse Configuration
```javascript
const guardrailTargetTime = process.env.GUARDRAIL_TARGET_TIME || "23:00";
const guardrailWindowMins = parseInt(process.env.GUARDRAIL_TARGET_WINDOW_IN_MINS) || 5;
```

### 2. Validate Time Format
- Must match regex: `/^(\d{1,2}):(\d{2})$/`
- Hour range: 0-23
- Minute range: 0-59
- Exit with error if invalid

### 3. Calculate Time Window
```javascript
const targetMinutes = targetHour * 60 + targetMinute;
const startMinutes = targetMinutes - guardrailWindowMins;  // Symmetric window
const endMinutes = targetMinutes + guardrailWindowMins;

const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
```

### 4. Format Times for Logging
Handle day boundaries correctly (e.g., 00:00 - 5 mins = 23:55):
```javascript
const formatTime = (mins) => {
  const normalizedMins = ((mins % 1440) + 1440) % 1440;  // 1440 = 24 * 60
  const h = Math.floor(normalizedMins / 60);
  const m = normalizedMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
```

### 5. Bypass Mechanism
Preserve `--run-anyway` flag to bypass guardrail for manual execution.

## Example Configurations
- **Default**: `23:00` ± 5 mins = 22:55–23:05 UTC
- **Midnight**: `00:40` ± 5 mins = 00:35–00:45 UTC
- **Wider window**: `12:00` with `GUARDRAIL_TARGET_WINDOW_IN_MINS=15` = 11:45–12:15 UTC

## Notes
- All times use UTC
- Window is symmetric (same minutes before/after)
- Log both the configured window and current time when exiting
