# Migrating from xlsx to ExcelJS

## Overview

This guide documents the migration from the vulnerable `xlsx` package to the secure `exceljs` package, including a critical date parsing issue that will affect most projects using Excel date cells.

**Date:** December 2024
**Reason for Migration:** The `xlsx` package (v0.18.5) has known security vulnerabilities with no patch available, including Prototype Pollution and Regular Expression Denial of Service (ReDoS).

## Package Comparison

| Feature | xlsx | exceljs |
|---------|------|---------|
| Version used | 0.18.5 | 4.4.0 |
| Security vulnerabilities | Yes (Prototype Pollution, ReDoS) | No vulnerabilities found |
| Date cell return type | Excel serial number (number) | JavaScript Date object |
| API style | Synchronous | Asynchronous (Promises) |
| Maintenance status | Inactive (no npm releases in 12+ months) | Active |
| Weekly downloads | ~2M | ~3.3M |

## Critical Issue: Date Parsing

### The Problem

**The most common migration issue is date parsing failure.** The two libraries return date values in fundamentally different formats:

- **xlsx**: Returns Excel serial numbers (e.g., `44927`)
- **exceljs**: Returns JavaScript `Date` objects

This means code that worked with `xlsx` will throw `RangeError: Invalid time value` when migrated to `exceljs`.

### Error Example

```
RangeError: Invalid time value
    at Date.toISOString (<anonymous>)
    at getRequestsParameterArrayFromExcelFile (utilitiesReadAndMakeFiles.js:46:12)
```

### Root Cause

The old `xlsx` library required converting Excel serial numbers to JavaScript dates:

```javascript
// xlsx: row.startDate = 44927 (serial number)
const date = new Date((row.startDate - 25569) * 86400 * 1000);
```

With `exceljs`, the value is already a `Date` object:

```javascript
// exceljs: row.startDate = Date object
const date = new Date((DateObject - 25569) * 86400 * 1000); // ❌ Produces NaN!
```

When you try to apply the serial number formula to a Date object, JavaScript coerces it incorrectly, resulting in `NaN`, which throws an error when calling `.toISOString()`.

## Migration Steps

### 1. Update package.json

**Remove:**
```json
"dependencies": {
  "xlsx": "^0.18.5"
}
```

**Add:**
```json
"dependencies": {
  "exceljs": "^4.4.0"
}
```

**Install:**
```bash
npm uninstall xlsx
npm install exceljs
```

**Verify:**
```bash
npm audit  # Should show 0 vulnerabilities
```

### 2. Update Import Statements

**Before (xlsx):**
```javascript
const xlsx = require("xlsx");
```

**After (exceljs):**
```javascript
const ExcelJS = require("exceljs");
```

### 3. Update File Reading Code

**Before (xlsx - synchronous):**
```javascript
function readExcelFile() {
  const workbook = xlsx.readFile("path/to/file.xlsx");
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = xlsx.utils.sheet_to_json(worksheet);

  return jsonData;
}
```

**After (exceljs - asynchronous):**
```javascript
async function readExcelFile() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile("path/to/file.xlsx");
  const worksheet = workbook.worksheets[0];

  // Convert to JSON manually
  const jsonData = [];
  const headers = {};

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // First row contains headers
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = cell.value;
      });
    } else {
      // Data rows
      const rowData = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          rowData[header] = cell.value;
        }
      });
      jsonData.push(rowData);
    }
  });

  return jsonData;
}
```

### 4. Fix Date Parsing (CRITICAL)

**Before (xlsx - BROKEN with exceljs):**
```javascript
const queryObjects = jsonData.map((row) => {
  const parsedDate = row.startDate
    ? new Date((row.startDate - 25569) * 86400 * 1000)
        .toISOString()
        .split("T")[0]
    : "";

  return {
    date: parsedDate,
    // ... other fields
  };
});
```

**After (exceljs - FIXED):**
```javascript
const queryObjects = jsonData.map((row) => {
  let parsedDate = "";
  if (row.startDate) {
    if (row.startDate instanceof Date) {
      // ExcelJS returns Date objects for date cells
      parsedDate = row.startDate.toISOString().split("T")[0];
    } else if (typeof row.startDate === "number") {
      // Fallback: Handle Excel serial numbers (backward compatibility)
      parsedDate = new Date((row.startDate - 25569) * 86400 * 1000)
        .toISOString()
        .split("T")[0];
    }
  }

  return {
    date: parsedDate,
    // ... other fields
  };
});
```

### 5. Update Function Calls to Handle Async

**Before:**
```javascript
function main() {
  const data = readExcelFile();
  processData(data);
}
```

**After:**
```javascript
async function main() {
  const data = await readExcelFile();
  processData(data);
}
```

## Date Parsing - Detailed Explanation

### Excel Serial Number Format

Excel stores dates as serial numbers:
- Number represents days since January 1, 1900 (or 1904 on Mac)
- Example: `44927` = December 28, 2024
- Fractional part represents time (e.g., `44927.5` = noon on that day)

### The Conversion Formula

```javascript
// Excel serial number to JavaScript Date
const jsDate = new Date((excelSerial - 25569) * 86400 * 1000);

// Where:
// 25569 = days between 1900-01-01 and 1970-01-01 (JavaScript epoch)
// 86400 = seconds in a day
// 1000 = milliseconds per second
```

### Why ExcelJS Returns Date Objects

ExcelJS automatically detects date-formatted cells and converts them to JavaScript Date objects for convenience. This is actually better than raw serial numbers, but requires code updates during migration.

### Defensive Date Parsing (Most Robust)

For maximum compatibility and error handling:

```javascript
function parseExcelDate(value) {
  if (!value) {
    return "";
  }

  try {
    if (value instanceof Date) {
      // ExcelJS Date object
      if (!isNaN(value.getTime())) {
        return value.toISOString().split("T")[0];
      }
    } else if (typeof value === "number") {
      // Excel serial number (xlsx or manual input)
      const date = new Date((value - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
    } else if (typeof value === "string") {
      // String date (ISO format or other)
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
    }
  } catch (error) {
    console.error("Error parsing date:", error);
  }

  return "";
}

// Usage:
const parsedDate = parseExcelDate(row.startDate);
```

## Testing After Migration

### 1. Unit Test Date Parsing

```javascript
// Test with Date object (exceljs behavior)
const dateObj = new Date("2024-12-28");
console.log(parseExcelDate(dateObj)); // Should output: 2024-12-28

// Test with serial number (xlsx behavior)
const serialNum = 45647; // Some date
console.log(parseExcelDate(serialNum)); // Should output valid date

// Test with invalid input
console.log(parseExcelDate(null)); // Should output: ""
console.log(parseExcelDate(undefined)); // Should output: ""
```

### 2. Integration Test

```javascript
// Run your actual Excel file reading
async function testExcelReading() {
  const data = await readExcelFile();
  console.log("First row:", data[0]);

  // Check that dates are properly formatted
  data.forEach((row, index) => {
    if (row.dateField && !/^\d{4}-\d{2}-\d{2}$/.test(row.dateField)) {
      console.error(`Invalid date format at row ${index}:`, row.dateField);
    }
  });
}
```

### 3. Error Monitoring

Watch for these errors indicating migration issues:
- `RangeError: Invalid time value`
- `TypeError: Cannot read property 'toISOString' of undefined`
- Date fields showing as `NaN` or empty strings

## Other Projects Using xlsx

If you have other projects using the `xlsx` package with date cells, they will need:

1. ✅ Update `package.json` to use `exceljs`
2. ✅ Change imports from `xlsx` to `ExcelJS`
3. ✅ Convert file reading from sync to async
4. ✅ **Fix date parsing to handle Date objects** (most critical)
5. ✅ Update all function calls to handle async/await
6. ✅ Test thoroughly with actual Excel files

## Common Pitfalls

### Pitfall 1: Forgetting await
```javascript
// ❌ Wrong - missing await
const data = readExcelFile();

// ✅ Correct
const data = await readExcelFile();
```

### Pitfall 2: Not handling empty cells
```javascript
// ❌ Wrong - will fail on empty cells
row.eachCell((cell) => {
  rowData[header] = cell.value;
});

// ✅ Correct - only process cells with values
row.eachCell((cell, colNumber) => {
  if (headers[colNumber]) {
    rowData[headers[colNumber]] = cell.value;
  }
});
```

### Pitfall 3: Assuming all dates are serial numbers
```javascript
// ❌ Wrong - assumes xlsx format
const date = new Date((value - 25569) * 86400 * 1000);

// ✅ Correct - checks type first
if (value instanceof Date) {
  // Handle Date object
} else if (typeof value === "number") {
  // Handle serial number
}
```

## References

- **xlsx package**: https://www.npmjs.com/package/xlsx
- **exceljs package**: https://www.npmjs.com/package/exceljs
- **Security advisory**: xlsx has known Prototype Pollution vulnerabilities (CVE-2023-XXXXX)
- **Excel date system**: https://support.microsoft.com/en-us/office/date-systems-in-excel

## Migration Checklist

Use this checklist for each project:

- [ ] Update `package.json` dependencies
- [ ] Run `npm uninstall xlsx && npm install exceljs`
- [ ] Verify `npm audit` shows 0 vulnerabilities
- [ ] Update all `require("xlsx")` to `require("exceljs")`
- [ ] Convert all file reading functions to async
- [ ] Fix date parsing with type checking
- [ ] Add `await` to all Excel reading function calls
- [ ] Test with actual Excel files
- [ ] Monitor for `RangeError: Invalid time value`
- [ ] Deploy and verify in production

## Example: Complete Migration

See the actual migration in this project:
- **Commit 1**: `fix: replace vulnerable xlsx package with secure exceljs` (8b7c338)
- **Commit 2**: `fix: handle ExcelJS Date objects in date parsing` (c0d4516)

Files changed:
- `package.json` - Updated dependencies
- `modules/utilitiesReadAndMakeFiles.js` - Main migration code
- `index.js` - Added await for async call

Total impact: ~20 lines of code changed to prevent security vulnerabilities and fix date parsing.
