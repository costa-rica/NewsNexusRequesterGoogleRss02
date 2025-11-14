require("dotenv").config();
const originalLog = console.log;
const originalError = console.error;
const prefix = `[${process.env.NAME_APP}] `;

console.log = (...args) => {
  originalLog(prefix, ...args);
};

console.error = (...args) => {
  originalError(prefix, ...args);
};

// require("./index");

// Time check: Only run between 22:50 and 23:10 UTC (time of the Ubuntu server)
const targetTimeToStartAutomation = 23;
const now = new Date();
const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
const startMinutes = (targetTimeToStartAutomation - 1) * 60 + 55; // 22:50 UTC
const endMinutes = targetTimeToStartAutomation * 60 + 5; // 23:10 UTC

if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
  console.log(`Running ${process.env.NAME_APP} between 22:55 and 23:10 UTC`);
  require("./index");
} else {
  console.log(
    `Not within allowed time window (22:55–23:10 UTC), exiting. Current UTC time: ${now.toISOString()}`
  );
}
