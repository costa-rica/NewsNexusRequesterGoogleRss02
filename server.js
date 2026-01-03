require("dotenv").config();
const originalLog = logger.info;
const originalError = logger.error;
const prefix = `[${process.env.NAME_APP}] `;

logger.info = (...args) => {
  originalLog(prefix, ...args);
};

logger.error = (...args) => {
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
  logger.info(`Running ${process.env.NAME_APP} between 22:55 and 23:10 UTC`);
  require("./index");
} else {
  logger.info(
    `Not within allowed time window (22:55–23:10 UTC), exiting. Current UTC time: ${now.toISOString()}`
  );
}
